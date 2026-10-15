from __future__ import annotations

import os
import shutil
import subprocess
import threading
import uuid
import json
import re
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
DATA_DIR = Path(os.environ.get("JAMLOOM_DATA", os.environ.get("STEMFORGE_DATA", BASE_DIR / "data"))).resolve()
UPLOAD_DIR = DATA_DIR / "uploads"
JOB_DIR = DATA_DIR / "jobs"
LIBRARY_DIR = DATA_DIR / "library"
for directory in (UPLOAD_DIR, JOB_DIR, LIBRARY_DIR):
    directory.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_BYTES = int(os.environ.get("JAMLOOM_MAX_UPLOAD_BYTES", os.environ.get("STEMFORGE_MAX_UPLOAD_BYTES", 500 * 1024 * 1024)))
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".flac", ".m4a", ".ogg", ".opus", ".aiff", ".aif", ".wma"}
MODELS = {
    "htdemucs": {"vocals", "drums", "bass", "other"},
    "htdemucs_6s": {"vocals", "drums", "bass", "guitar", "piano", "other"},
}

app = FastAPI(title="Jamloom", version="0.3.1")
app.include_router(sessions_router)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")

jobs: dict[str, dict[str, Any]] = {}
jobs_lock = threading.Lock()


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
        completed_track["progress"] = "Saved to your library."
        update_job(job_id, **completed_track)
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


@app.get("/api/library")
async def list_library():
    with jobs_lock:
        tracks = [dict(job) for job in jobs.values() if job.get("status") == "completed" and job.get("library_id", job.get("id")) == job.get("id")]
    tracks.sort(key=lambda track: track.get("created_at", ""), reverse=True)
    return {"tracks": tracks, "count": len(tracks)}


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
