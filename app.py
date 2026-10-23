from __future__ import annotations

import os
import shutil
import subprocess
import threading
import uuid
import json
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import BackgroundTasks, Body, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.requests import Request

from sessions import router as sessions_router

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("JAMLOOM_DATA", BASE_DIR / "data")).resolve()
UPLOAD_DIR = DATA_DIR / "uploads"
JOB_DIR = DATA_DIR / "jobs"
LIBRARY_DIR = DATA_DIR / "library"
for directory in (UPLOAD_DIR, JOB_DIR, LIBRARY_DIR):
    directory.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_BYTES = int(os.environ.get("JAMLOOM_MAX_UPLOAD_BYTES", 500 * 1024 * 1024))
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".flac", ".m4a", ".ogg", ".opus", ".aiff", ".aif", ".wma"}
OPEN_STRING_MIDI = {
    "guitar": {1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40},
    "bass": {1: 43, 2: 38, 3: 33, 4: 28},
}
MODELS = {
    "htdemucs": {"vocals", "drums", "bass", "other"},
    "htdemucs_6s": {"vocals", "drums", "bass", "guitar", "piano", "other"},
}

app = FastAPI(title="Jamloom", version="0.4.44")
app.include_router(sessions_router)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")

jobs: dict[str, dict[str, Any]] = {}
jobs_lock = threading.Lock()
note_workers_lock = threading.Lock()
note_workers: set[str] = set()


def track_dir(track_id: str) -> Path:
    """Return the persistent directory for a library track, or its temporary job directory."""
    library_path = LIBRARY_DIR / track_id
    return library_path if library_path.is_dir() else JOB_DIR / track_id


def public_track(metadata: dict[str, Any]) -> dict[str, Any]:
    track_id = metadata["id"]
    model = metadata["model"]
    stems = metadata.get("stems") or sorted(MODELS.get(model, set()))
    return {
        **metadata,
        "bpm": metadata.get("bpm"),
        "time_signature": metadata.get("time_signature", ""),
        "status": "completed",
        "progress": "Ready in your library.",
        "backing_url": f"/api/jobs/{track_id}/backing",
        "download_url": f"/api/jobs/{track_id}/download",
        "stems": {stem: f"/api/jobs/{track_id}/stems/{stem}" for stem in stems},
        "available_stems": stems,
    }


def analyze_pitch_track(audio_path: Path, stem_name: str) -> dict[str, Any]:
    """Lightweight monophonic pitch estimate from a separated instrument stem."""
    import numpy as np
    import soundfile as sf

    audio, sample_rate = sf.read(str(audio_path), dtype="float32", always_2d=True)
    if audio.shape[1] > 1:
        audio = audio.mean(axis=1)
    else:
        audio = audio[:, 0]
    if len(audio) < sample_rate // 2:
        raise ValueError("The audio stem is too short to analyze.")
    # Reduce computation while keeping enough bandwidth for bass and guitar fundamentals.
    factor = max(1, int(np.ceil(sample_rate / 12000)))
    audio = audio[::factor]
    sample_rate = sample_rate / factor
    # Keep analysis bounded for exceptionally long files; the UI will say if truncated.
    max_samples = int(sample_rate * 15 * 60)
    truncated = len(audio) > max_samples
    audio = audio[:max_samples]
    window_size = 4096
    hop_size = 1102  # about 100 ms at 11 kHz
    if len(audio) < window_size:
        raise ValueError("The audio stem is too short to analyze.")
    window = np.hanning(window_size).astype(np.float32)
    fft_size = 1 << (2 * window_size - 1).bit_length()
    min_hz = 35.0 if stem_name == "bass" else 55.0
    max_hz = 1200.0
    min_lag = max(2, int(sample_rate / max_hz))
    max_lag = min(window_size - 2, int(sample_rate / min_hz))
    note_names = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"]
    frames: list[dict[str, Any]] = []
    for start in range(0, len(audio) - window_size + 1, hop_size):
        frame = audio[start:start + window_size].astype(np.float32, copy=False)
        frame = frame - float(frame.mean())
        rms = float(np.sqrt(np.mean(frame * frame)))
        if rms < 0.003:
            frames.append({"time": start / sample_rate, "midi": None, "frequency_hz": None, "confidence": 0.0})
            continue
        weighted = frame * window
        spectrum = np.fft.rfft(weighted, n=fft_size)
        autocorr = np.fft.irfft(spectrum * np.conjugate(spectrum), n=fft_size)[:window_size]
        # Normalize for the shrinking overlap at larger lags.
        overlap = np.arange(window_size, 0, -1, dtype=np.float32)
        autocorr = autocorr / overlap
        if autocorr[0] <= 0:
            frames.append({"time": start / sample_rate, "midi": None, "frequency_hz": None, "confidence": 0.0})
            continue
        normalized = autocorr / autocorr[0]
        section = normalized[min_lag:max_lag + 1]
        lag_index = int(np.argmax(section)) + min_lag
        # Parabolic interpolation makes pitch estimates less dependent on integer sample lag.
        if 1 <= lag_index < window_size - 1:
            left, center, right = normalized[lag_index - 1:lag_index + 2]
            denom = left - 2 * center + right
            shift = 0.5 * (left - right) / denom if abs(denom) > 1e-9 else 0.0
        else:
            shift = 0.0
        frequency = sample_rate / (lag_index + float(np.clip(shift, -0.5, 0.5)))
        # Autocorrelation can lock onto a subharmonic when a bass note's fundamental
        # is weak. If the candidate is low and the spectrum strongly favors its octave,
        # correct it upward. Compare local spectral peaks to tolerate FFT-bin mismatch.
        magnitude = np.abs(spectrum)
        bin_hz = sample_rate / fft_size
        def local_peak(hz: float) -> float:
            center_bin = int(round(hz / bin_hz))
            lo = max(1, center_bin - 1)
            hi = min(len(magnitude), center_bin + 2)
            return float(np.max(magnitude[lo:hi])) if lo < hi else 0.0
        fundamental_peak = local_peak(frequency)
        octave_peak = local_peak(frequency * 2.0)
        octave_limit = 90.0 if stem_name == "bass" else 120.0
        if frequency < octave_limit and octave_peak > fundamental_peak * 1.65:
            frequency *= 2.0
        confidence = float(np.clip(normalized[lag_index], 0.0, 1.0))
        midi = int(round(69 + 12 * np.log2(frequency / 440.0))) if frequency > 0 else None
        if confidence < 0.55 or midi is None or midi < 24 or midi > 88:
            midi = None
        frames.append({"time": round(start / sample_rate, 3), "midi": midi,
                       "frequency_hz": round(float(frequency), 2) if midi is not None else None,
                       "confidence": round(confidence, 3)})

    # Correct isolated octave flips when both neighboring frames agree. This is
    # deliberately conservative: sustained changes in the actual melody remain intact.
    for i in range(1, len(frames) - 1):
        prev_midi, midi, next_midi = frames[i - 1]["midi"], frames[i]["midi"], frames[i + 1]["midi"]
        if prev_midi is not None and next_midi is not None and midi is not None:
            if prev_midi == next_midi and abs(midi - prev_midi) == 12:
                frames[i]["midi"] = prev_midi
                frames[i]["frequency_hz"] = frames[i - 1]["frequency_hz"]

    # Merge neighboring frames of the same pitch; suppress very short flickers.
    events: list[dict[str, Any]] = []
    frame_seconds = hop_size / sample_rate
    for frame in frames:
        midi = frame["midi"]
        if events and events[-1]["midi"] == midi and frame["time"] - events[-1]["end"] <= frame_seconds * 1.6:
            events[-1]["end"] = round(frame["time"] + frame_seconds, 3)
            events[-1]["confidence"] = round((events[-1]["confidence"] + frame["confidence"]) / 2, 3)
            if frame.get("frequency_hz") is not None:
                previous_hz = events[-1].get("frequency_hz", frame["frequency_hz"])
                events[-1]["frequency_hz"] = round((previous_hz + frame["frequency_hz"]) / 2, 2)
        elif midi is not None:
            events.append({"start": frame["time"], "end": round(frame["time"] + frame_seconds, 3), "midi": midi,
                           "frequency_hz": frame.get("frequency_hz"), "confidence": frame["confidence"]})
    events = [event for event in events if event["end"] - event["start"] >= 0.09]
    if events and frames and frames[-1]["midi"] == events[-1]["midi"]:
        events[-1]["end"] = round(len(audio) / sample_rate, 3)
    for event in events:
        midi = event["midi"]
        event["note"] = f"{note_names[midi % 12]}{midi // 12 - 1}"
    return {"stem": stem_name, "sample_rate": int(sample_rate), "duration": round(len(audio) / sample_rate, 3), "truncated": truncated, "events": events}



def note_status_path(track_id: str) -> Path:
    return track_dir(track_id) / "note-analysis-status.json"


def read_note_status(track_id: str) -> dict[str, Any]:
    try:
        value = json.loads(note_status_path(track_id).read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        return {}


def write_note_status(track_id: str, stem_name: str, status: str, message: str = "") -> None:
    statuses = read_note_status(track_id)
    statuses[stem_name] = {"status": status, "message": message}
    path = note_status_path(track_id)
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(statuses, indent=2), encoding="utf-8")
    temporary.replace(path)
    update_job(track_id, note_analysis=statuses)


def available_note_stems(track_id: str) -> list[str]:
    with jobs_lock:
        job = dict(jobs.get(track_id, {}))
    model = job.get("model")
    if not model:
        try:
            model = json.loads((LIBRARY_DIR / track_id / "track.json").read_text(encoding="utf-8")).get("model")
        except (OSError, ValueError):
            return []
    model_root = track_dir(track_id) / "separated" / model
    return [stem for stem in ("bass", "guitar") if list(model_root.glob(f"*/{stem}.wav")) or list(model_root.glob(f"{stem}.wav"))]


def save_pitch_analysis(track_id: str, stem_name: str, result: dict[str, Any]) -> None:
    path = track_dir(track_id) / f"notes-{stem_name}.json"
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    temporary.replace(path)


def _note_analysis_worker(track_id: str, stems: list[str] | None = None) -> None:
    try:
        requested = stems or available_note_stems(track_id)
        with jobs_lock:
            job = dict(jobs.get(track_id, {}))
        model = job.get("model", "htdemucs")
        for stem_name in requested:
            path = track_dir(track_id) / f"notes-{stem_name}.json"
            if path.is_file():
                write_note_status(track_id, stem_name, "completed", "Saved note suggestions are ready.")
                continue
            candidates = list((track_dir(track_id) / "separated" / model).glob(f"*/{stem_name}.wav"))
            if not candidates:
                candidates = list((track_dir(track_id) / "separated").glob(f"**/{stem_name}.wav"))
            if not candidates:
                write_note_status(track_id, stem_name, "unavailable", f"No {stem_name} stem is available.")
                continue
            write_note_status(track_id, stem_name, "running", f"Analyzing {stem_name} notes in the background…")
            try:
                result = analyze_pitch_track(candidates[0], stem_name)
                save_pitch_analysis(track_id, stem_name, result)
                write_note_status(track_id, stem_name, "completed", f"{len(result['events'])} note suggestions detected.")
            except Exception as exc:
                write_note_status(track_id, stem_name, "failed", f"Automatic {stem_name} analysis failed: {exc}")
    finally:
        with note_workers_lock:
            note_workers.discard(track_id)


def start_automatic_note_analysis(track_id: str, stems: list[str] | None = None) -> None:
    with note_workers_lock:
        if track_id in note_workers:
            return
        note_workers.add(track_id)
    threading.Thread(target=_note_analysis_worker, args=(track_id, stems), daemon=True, name=f"jamloom-notes-{track_id[:8]}").start()


def load_persistent_library() -> None:
    """Restore completed tracks into the in-memory job index after a server restart."""
    for metadata_path in LIBRARY_DIR.glob("*/track.json"):
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            if not metadata.get("id") or not metadata.get("model"):
                continue
            track = public_track(metadata)
            if (LIBRARY_DIR / track["id"] / "backing.wav").is_file():
                jobs[track["id"]] = track
        except (OSError, ValueError, KeyError):
            continue


def write_track_metadata(track_id: str, filename: str, model: str, backing_path: Path) -> dict[str, Any]:
    import soundfile as sf
    info = sf.info(str(backing_path))
    metadata = {
        "id": track_id,
        "filename": filename,
        "title": Path(filename).stem or "Untitled track",
        "artist": "",
        "album": "",
        "bpm": None,
        "time_signature": "",
        "model": model,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "duration": round(float(info.duration), 3),
        "sample_rate": int(info.samplerate),
        "stems": sorted(p.stem for p in (LIBRARY_DIR / track_id / "separated" / model).glob("*/*.wav"))
            or sorted(p.stem for p in (LIBRARY_DIR / track_id / "separated" / model).glob("*.wav")),
    }
    target = LIBRARY_DIR / track_id / "track.json"
    temporary = target.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    temporary.replace(target)
    return metadata


load_persistent_library()


def update_job(job_id: str, **values: Any) -> None:
    with jobs_lock:
        if job_id in jobs:
            jobs[job_id].update(values)


def safe_output_name(name: str) -> str:
    # The uploaded name is never used as a path; this is only a display/download name.
    cleaned = Path(name).name
    return "".join(c for c in cleaned if c.isalnum() or c in " ._-()").strip()[:160] or "track"


def run_separation(job_id: str, source: Path, model: str) -> None:
    job_root = JOB_DIR / job_id
    separated_root = job_root / "separated"
    output_path = job_root / "backing.wav"
    job_root.mkdir(parents=True, exist_ok=True)
    try:
        update_job(job_id, status="processing", progress="Running Demucs separation. This may take a while on the first run.")
        command = [
            os.environ.get("PYTHON", shutil.which("python") or "python"), "-m", "demucs",
            "-n", model, "--out", str(separated_root), str(source),
        ]
        completed = subprocess.run(command, capture_output=True, text=True, timeout=6 * 60 * 60)
        if completed.returncode != 0:
            details = (completed.stderr or completed.stdout or "Demucs exited with an error.")[-5000:]
            raise RuntimeError(details)

        # Demucs writes: separated/<model>/<input-stem>/<stem>.wav
        track_dir = separated_root / model / source.stem
        if not track_dir.is_dir():
            # Demucs may normalize/sanitize the source stem; find the model's first track directory.
            model_dir = separated_root / model
            candidates = [p for p in model_dir.iterdir() if p.is_dir()] if model_dir.exists() else []
            if len(candidates) != 1:
                raise RuntimeError("Could not locate Demucs output stems.")
            track_dir = candidates[0]

        import soundfile as sf
        import numpy as np

        stem_paths = {p.stem: p for p in track_dir.glob("*.wav")}
        if not stem_paths:
            raise RuntimeError("Demucs finished but produced no WAV stems.")
        # Always build the full mix from every separated stem. Instrument choices
        # now happen in the browser mixer, without requiring another separation.
        included = list(stem_paths.values())
        update_job(job_id, progress="Mixing all stems…", available_stems=sorted(stem_paths))
        mix = None
        sample_rate = None
        for path in included:
            audio, sr = sf.read(path, dtype="float32", always_2d=True)
            if sample_rate is None:
                sample_rate = sr
                mix = np.zeros_like(audio)
            if sr != sample_rate or audio.shape != mix.shape:
                raise RuntimeError("Stem audio formats do not match; cannot mix safely.")
            mix += audio
        assert mix is not None and sample_rate is not None
        # Keep headroom to avoid clipping after summing stems.
        peak = float(np.max(np.abs(mix))) if mix.size else 0.0
        if peak > 0.999:
            mix *= 0.999 / peak
        sf.write(output_path, mix, sample_rate, subtype="PCM_16")

        # Promote successful jobs into the persistent, server-wide song library.
        library_root = LIBRARY_DIR / job_id
        library_root.mkdir(parents=True, exist_ok=True)
        if source.is_file():
            shutil.move(str(source), str(library_root / f"original{source.suffix.lower()}"))
        shutil.move(str(output_path), str(library_root / "backing.wav"))
        if separated_root.exists():
            shutil.move(str(separated_root), str(library_root / "separated"))
        shutil.rmtree(job_root, ignore_errors=True)
        metadata = write_track_metadata(job_id, jobs[job_id]["filename"], model, library_root / "backing.wav")
        completed_track = public_track(metadata)
        completed_track["progress"] = "Saved to your library. Note suggestions are being analyzed in the background."
        update_job(job_id, **completed_track)
        # Make the track available immediately; pitch analysis continues independently.
        start_automatic_note_analysis(job_id, [stem for stem in ("bass", "guitar") if stem in stem_paths])
    except subprocess.TimeoutExpired:
        update_job(job_id, status="failed", error="Separation exceeded the six-hour limit.")
    except Exception as exc:
        update_job(job_id, status="failed", error=str(exc))


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(request=request, name="index.html", context={"models": MODELS})


@app.get("/api/health")
async def health():
    return {"status": "ok", "demucs_available": shutil.which("demucs") is not None}


@app.post("/api/jobs")
async def create_job(
    file: UploadFile = File(...),
    model: str = Form("htdemucs"),
    # Accept the old field for compatibility with cached clients, but ignore it:
    # all stems are now included and can be muted in the in-browser mixer.
    exclude: str | None = Form(None),
):
    if model not in MODELS:
        raise HTTPException(400, "Unknown separation model.")
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file extension. Supported: {', '.join(sorted(ALLOWED_EXTENSIONS))}")
    job_id = uuid.uuid4().hex
    destination = UPLOAD_DIR / f"{job_id}{suffix}"
    total = 0
    try:
        with destination.open("wb") as out:
            while chunk := await file.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_UPLOAD_BYTES:
                    out.close()
                    destination.unlink(missing_ok=True)
                    raise HTTPException(413, f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MiB upload limit.")
                out.write(chunk)
    finally:
        await file.close()
    if total == 0:
        destination.unlink(missing_ok=True)
        raise HTTPException(400, "The uploaded file is empty.")

    jobs[job_id] = {
        "id": job_id,
        "filename": safe_output_name(file.filename or "track"),
        "status": "queued",
        "progress": "Waiting to start…",
        "model": model,
    }
    threading.Thread(target=run_separation, args=(job_id, destination, model), daemon=True).start()
    return {"id": job_id, "status": "queued", "status_url": f"/api/jobs/{job_id}"}


@app.get("/api/jobs/{job_id}")
async def job_status(job_id: str):
    with jobs_lock:
        job = jobs.get(job_id)
        if not job:
            raise HTTPException(404, "Job not found.")
        return dict(job)


@app.get("/api/jobs/{job_id}/backing")
async def backing(job_id: str):
    with jobs_lock:
        job = jobs.get(job_id)
    path = track_dir(job_id) / "backing.wav"
    if not job or job.get("status") != "completed" or not path.is_file():
        raise HTTPException(404, "Backing track is not ready.")
    return FileResponse(path, media_type="audio/wav", filename="backing-track.wav")


@app.get("/api/jobs/{job_id}/download")
async def download_backing(job_id: str):
    with jobs_lock:
        job = jobs.get(job_id)
    path = track_dir(job_id) / "backing.wav"
    if not job or job.get("status") != "completed" or not path.is_file():
        raise HTTPException(404, "Backing track is not ready.")
    stem = Path(job["filename"]).stem or "track"
    return FileResponse(path, media_type="audio/wav", filename=f"{stem}-backing.wav")


@app.get("/api/jobs/{job_id}/stems/{stem_name}")
async def get_stem(job_id: str, stem_name: str):
    if stem_name not in {"vocals", "drums", "bass", "guitar", "piano", "other"}:
        raise HTTPException(400, "Invalid stem name.")
    with jobs_lock:
        job = jobs.get(job_id)
    if not job or job.get("status") != "completed":
        raise HTTPException(404, "Stems are not ready.")
    candidates = list((track_dir(job_id) / "separated" / job["model"]).glob(f"*/{stem_name}.wav"))
    if not candidates:
        raise HTTPException(404, "Stem not found for this model.")
    return FileResponse(candidates[0], media_type="audio/wav", filename=f"{stem_name}.wav")


@app.get("/api/jobs/{job_id}/notes/{stem_name}")
async def get_pitch_analysis(job_id: str, stem_name: str):
    if stem_name not in {"bass", "guitar"}:
        raise HTTPException(400, "Pitch analysis currently supports bass and guitar stems.")
    with jobs_lock:
        job = jobs.get(job_id)
    if not job or job.get("status") != "completed":
        raise HTTPException(404, "Track is not ready.")
    analysis_path = track_dir(job_id) / f"notes-{stem_name}.json"
    if analysis_path.is_file():
        try:
            result = json.loads(analysis_path.read_text(encoding="utf-8"))
            arrangement_path = track_dir(job_id) / f"arrangement-{stem_name}.json"
            if arrangement_path.is_file():
                try:
                    result["arrangement_events"] = json.loads(arrangement_path.read_text(encoding="utf-8")).get("events", [])
                except (OSError, ValueError, AttributeError):
                    result["arrangement_events"] = None
            else:
                result["arrangement_events"] = None
            return result
        except (OSError, ValueError):
            raise HTTPException(500, "Saved note analysis could not be read.")
    if stem_name not in available_note_stems(job_id):
        raise HTTPException(404, f"This track has no {stem_name} stem.")
    status = read_note_status(job_id).get(stem_name, {})
    if not status or status.get("status") in {"pending", "running"}:
        start_automatic_note_analysis(job_id)
        status = read_note_status(job_id).get(stem_name, {})
        return {"status": status.get("status", "pending"), "message": status.get("message", "Note analysis is queued in the background…")}
    return {"status": status.get("status", "pending"), "message": status.get("message", "")}


@app.post("/api/jobs/{job_id}/notes/{stem_name}")
async def create_pitch_analysis(job_id: str, stem_name: str):
    if stem_name not in {"bass", "guitar"}:
        raise HTTPException(400, "Choose the bass or guitar stem for pitch analysis.")
    with jobs_lock:
        job = jobs.get(job_id)
    if not job or job.get("status") != "completed":
        raise HTTPException(404, "Track is not ready.")
    candidates = list((track_dir(job_id) / "separated" / job["model"]).glob(f"*/{stem_name}.wav"))
    if not candidates:
        raise HTTPException(404, f"This track has no {stem_name} stem. Try a model that separates {stem_name}.")
    analysis_path = track_dir(job_id) / f"notes-{stem_name}.json"
    with note_workers_lock:
        if job_id in note_workers:
            raise HTTPException(409, "Automatic note analysis is already running. Please wait for it to finish.")
    try:
        result = analyze_pitch_track(candidates[0], stem_name)
    except ImportError as exc:
        raise HTTPException(500, "Pitch analysis needs NumPy and SoundFile in Jamloom's Python environment.") from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(500, f"Pitch analysis failed: {exc}") from exc
    save_pitch_analysis(job_id, stem_name, result)
    write_note_status(job_id, stem_name, "completed", f"{len(result['events'])} note suggestions detected.")
    return result


@app.put("/api/jobs/{job_id}/arrangements/{stem_name}")
async def save_note_arrangement(job_id: str, stem_name: str, payload: dict[str, Any] = Body(...)):
    """Save user edits separately from the original automatic pitch suggestions."""
    if stem_name not in {"bass", "guitar"}:
        raise HTTPException(400, "Choose the bass or guitar stem.")
    with jobs_lock:
        job = jobs.get(job_id)
    if not job or job.get("status") != "completed":
        raise HTTPException(404, "Track is not ready.")
    analysis_path = track_dir(job_id) / f"notes-{stem_name}.json"
    if not analysis_path.is_file():
        raise HTTPException(409, "Run note analysis before editing an arrangement.")
    try:
        analysis = json.loads(analysis_path.read_text(encoding="utf-8"))
        duration = float(analysis.get("duration", 0))
    except (OSError, ValueError, TypeError):
        raise HTTPException(500, "The original note analysis could not be read.")
    events = payload.get("events")
    if not isinstance(events, list) or len(events) > 20000:
        raise HTTPException(400, "Arrangement events must be a list of at most 20,000 notes.")
    note_names = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"]
    normalized = []
    for index, event in enumerate(events):
        if not isinstance(event, dict):
            raise HTTPException(400, f"Note {index + 1} is invalid.")
        try:
            midi = int(event.get("midi"))
            start = float(event.get("start"))
            end = float(event.get("end"))
        except (TypeError, ValueError):
            raise HTTPException(400, f"Note {index + 1} needs a pitch, start and end time.")
        if midi < 0 or midi > 127:
            raise HTTPException(400, f"Note {index + 1} has an invalid MIDI pitch.")
        if not (0 <= start < end <= duration + 0.05):
            raise HTTPException(400, f"Note {index + 1} must start before it ends and stay within the song.")
        start = round(max(0.0, start), 3)
        end = round(min(duration, end), 3)
        if end <= start:
            raise HTTPException(400, f"Note {index + 1} is too short.")
        string_value = event.get("string")
        fret_value = event.get("fret")
        if string_value in (None, "") and fret_value in (None, ""):
            string_value = fret_value = None
        else:
            try:
                string_value, fret_value = int(string_value), int(fret_value)
            except (TypeError, ValueError):
                raise HTTPException(400, f"Note {index + 1} has an invalid guitar tab position.")
            open_midi = OPEN_STRING_MIDI[stem_name]
            if string_value not in open_midi or not 0 <= fret_value <= 24 or open_midi[string_value] + fret_value != midi:
                instrument = "bass" if stem_name == "bass" else "guitar"
                raise HTTPException(400, f"Note {index + 1} has a {instrument} string/fret position that does not match its pitch.")
        normalized.append({
            "start": start, "end": end, "midi": midi,
            "note": f"{note_names[midi % 12]}{midi // 12 - 1}",
            "frequency_hz": round(440.0 * (2.0 ** ((midi - 69) / 12.0)), 2),
            "confidence": float(event.get("confidence", 1.0)) if str(event.get("confidence", 1.0)).replace('.', '', 1).isdigit() else 1.0,
            "string": string_value, "fret": fret_value,
            "muted_string": bool(event.get("muted_string", False)),
            "edited": True, "chord_tone": bool(event.get("chord_tone", False)),
        })
    normalized.sort(key=lambda event: (event["start"], event["end"]))
    target = track_dir(job_id) / f"arrangement-{stem_name}.json"
    target.write_text(json.dumps({"stem": stem_name, "duration": duration, "events": normalized,
                                  "updated_at": datetime.now(timezone.utc).isoformat()}, indent=2), encoding="utf-8")
    return {"saved": True, "events": normalized, "message": f"Saved {len(normalized)} arrangement notes."}


def directory_size_bytes(directory: Path) -> int:
    """Return the size of regular files stored under a track directory."""
    total = 0
    try:
        for path in directory.rglob("*"):
            try:
                if path.is_file() and not path.is_symlink():
                    total += path.stat().st_size
            except OSError:
                # A file may disappear while the library is being inspected.
                continue
    except OSError:
        return total
    return total




def parse_musicxml(data: bytes) -> dict[str, Any]:
    """Parse a bounded MusicXML score into a lightweight, browser-friendly representation."""
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(413, "MusicXML files must be 20 MB or smaller.")
    try:
        root = ET.fromstring(data)
    except ET.ParseError:
        raise HTTPException(400, "This does not appear to be valid MusicXML.")
    if root.tag not in {"score-partwise", "score-timewise"}:
        raise HTTPException(400, "Please import a partwise or timewise MusicXML score.")
    if root.tag == "score-timewise":
        raise HTTPException(400, "Timewise MusicXML is not supported yet. Export as partwise MusicXML from your notation app.")
    def child_text(node, tag, default=""):
        child = node.find(tag)
        return child.text.strip() if child is not None and child.text else default
    part_names = {}
    for part in root.findall('./part-list/score-part'):
        part_names[part.get('id', '')] = child_text(part, 'part-name', 'Part')
    parts = []
    for part in root.findall('part'):
        measures = []
        divisions, tempo, beats, beat_type = 1, 120.0, 4, 4
        for measure_index, measure in enumerate(part.findall('measure')):
            attrs = measure.find('attributes')
            if attrs is not None:
                divisions = int(child_text(attrs, 'divisions', str(divisions)) or divisions)
                ts = attrs.find('time')
                if ts is not None:
                    beats = int(child_text(ts, 'beats', str(beats)) or beats)
                    beat_type = int(child_text(ts, 'beat-type', str(beat_type)) or beat_type)
            for direction in measure.findall('direction'):
                sound = direction.find('sound')
                if sound is not None and sound.get('tempo'):
                    try: tempo = float(sound.get('tempo'))
                    except ValueError: pass
                metronome = direction.find('./direction-type/metronome')
                if metronome is not None:
                    try: tempo = float(child_text(metronome, 'per-minute', str(tempo)))
                    except ValueError: pass
            cursor = 0.0
            notes = []
            for note in measure.findall('note'):
                duration = float(child_text(note, 'duration', '0') or 0) / max(divisions, 1)
                if note.find('chord') is None:
                    start = cursor
                    if note.find('grace') is None: cursor += duration
                else:
                    start = max(0.0, cursor - duration)
                if note.find('rest') is not None:
                    continue
                pitch = note.find('pitch')
                step = child_text(pitch, 'step') if pitch is not None else ''
                alter = int(child_text(pitch, 'alter', '0') or 0) if pitch is not None else 0
                octave = child_text(pitch, 'octave') if pitch is not None else ''
                accidental = { -2:'bb', -1:'b', 1:'#', 2:'##' }.get(alter, '')
                tech = note.find('./notations/technical')
                string_no = int(child_text(tech, 'string', '0') or 0) if tech is not None else 0
                fret_text = child_text(tech, 'fret', '') if tech is not None else ''
                notes.append({'beat': round(start, 4), 'duration': round(duration, 4), 'pitch': f'{step}{accidental}{octave}' if step else '', 'string': string_no or None, 'fret': int(fret_text) if fret_text.isdigit() else None, 'rest': False})
            measures.append({'number': measure.get('number', str(measure_index + 1)), 'beats': beats * 4 / max(beat_type, 1), 'notes': notes})
        parts.append({'id': part.get('id', ''), 'name': part_names.get(part.get('id', ''), 'Part'), 'measures': measures})
    if not parts:
        raise HTTPException(400, "No score parts were found in this MusicXML file.")
    return {'title': child_text(root, 'movement-title', ''), 'tempo': tempo, 'time_signature': f'{beats}/{beat_type}', 'parts': parts}


@app.post('/api/library/{track_id}/musicxml')
async def import_musicxml(track_id: str, file: UploadFile = File(...)):
    if not track_id or any(ch not in '0123456789abcdef' for ch in track_id.lower()):
        raise HTTPException(400, 'Invalid library track ID.')
    path = LIBRARY_DIR / track_id
    with jobs_lock:
        job = jobs.get(track_id)
        if not job or job.get('status') != 'completed' or not path.is_dir():
            raise HTTPException(404, 'Library track not found.')
    if Path(file.filename or '').suffix.lower() not in {'.musicxml', '.xml', '.mxl'}:
        raise HTTPException(400, 'Choose a .musicxml or .xml file. Compressed .mxl files are not supported yet; export uncompressed MusicXML.')
    data = await file.read(20 * 1024 * 1024 + 1)
    score = parse_musicxml(data)
    score['source_filename'] = Path(file.filename or 'score.musicxml').name[:200]
    (path / 'musicxml.json').write_text(json.dumps(score, ensure_ascii=False, indent=2), encoding='utf-8')
    return score


@app.get('/api/library/{track_id}/musicxml')
async def get_musicxml(track_id: str):
    if not track_id or any(ch not in '0123456789abcdef' for ch in track_id.lower()):
        raise HTTPException(400, 'Invalid library track ID.')
    score_path = LIBRARY_DIR / track_id / 'musicxml.json'
    if not score_path.is_file():
        raise HTTPException(404, 'No MusicXML score has been imported for this track.')
    try: return json.loads(score_path.read_text(encoding='utf-8'))
    except (OSError, ValueError): raise HTTPException(500, 'Could not read the saved MusicXML score.')


@app.get("/api/library")
async def list_library():
    with jobs_lock:
        tracks = [dict(job) for job in jobs.values() if job.get("status") == "completed" and job.get("library_id", job.get("id")) == job.get("id")]
    tracks.sort(key=lambda track: track.get("created_at", ""), reverse=True)
    total_storage_bytes = 0
    for track in tracks:
        folder = LIBRARY_DIR / str(track.get("id", ""))
        size = directory_size_bytes(folder) if folder.is_dir() else 0
        track["storage_bytes"] = size
        total_storage_bytes += size
    return {"tracks": tracks, "count": len(tracks), "total_storage_bytes": total_storage_bytes}


@app.patch("/api/library/{track_id}")
async def update_library_track(track_id: str, payload: dict[str, Any] = Body(...)):
    if not track_id or any(ch not in "0123456789abcdef" for ch in track_id.lower()):
        raise HTTPException(400, "Invalid library track ID.")
    allowed = {"title", "artist", "album", "bpm", "time_signature"}
    if not payload or set(payload) - allowed:
        raise HTTPException(400, "Editable fields are title, artist, album, BPM and time signature.")
    if "bpm" in payload:
        bpm = payload["bpm"]
        if bpm is not None and (isinstance(bpm, bool) or not isinstance(bpm, (int, float)) or not 1 <= bpm <= 400):
            raise HTTPException(400, "BPM must be between 1 and 400, or empty.")
    if "time_signature" in payload:
        signature = payload["time_signature"]
        if not isinstance(signature, str):
            raise HTTPException(400, "Time signature must be text.")
        signature = " ".join(signature.split())
        if signature and not re.fullmatch(r"(?:[1-9]|1[0-6])\s*/\s*(?:1|2|4|8|16)", signature):
            raise HTTPException(400, "Time signature must look like 4/4, 3/4 or 6/8 (numerator 1–16; denominator 1, 2, 4, 8 or 16).")
    path = LIBRARY_DIR / track_id
    with jobs_lock:
        job = jobs.get(track_id)
        if not job or job.get("status") != "completed" or not path.is_dir():
            raise HTTPException(404, "Library track not found.")
        metadata_path = path / "track.json"
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            metadata = {key: job.get(key) for key in ("id", "filename", "model", "created_at", "duration", "sample_rate", "stems")}
        for key, value in payload.items():
            if key == "bpm":
                metadata[key] = round(float(value), 2) if value is not None else None
            elif key == "time_signature":
                metadata[key] = re.sub(r"\s*/\s*", "/", " ".join(value.split()))[:12]
            else:
                if not isinstance(value, str):
                    raise HTTPException(400, f"{key} must be text.")
                metadata[key] = " ".join(value.split())[:160]
        temporary = metadata_path.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
        temporary.replace(metadata_path)
        job.update({key: metadata.get(key, "") for key in allowed})
    return {"track": dict(job)}


@app.delete("/api/library/{track_id}")
async def delete_library_track(track_id: str):
    # Only valid UUID-like IDs can address a direct child of the library folder.
    if not track_id or any(ch not in "0123456789abcdef" for ch in track_id.lower()):
        raise HTTPException(400, "Invalid library track ID.")
    path = LIBRARY_DIR / track_id
    with jobs_lock:
        job = jobs.get(track_id)
        if not job or job.get("status") != "completed" or not path.is_dir():
            raise HTTPException(404, "Library track not found.")
        shutil.rmtree(path, ignore_errors=False)
        jobs.pop(track_id, None)
    return {"deleted": track_id}
