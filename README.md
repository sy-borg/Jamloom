# Jamloom

**Your music. Your part. Your jam.**

Jamloom is a local-first music practice app. Import a track, separate it into stems with Demucs, and practise with playback controls, an editable note arrangement, and guitar or bass tablature. Your library and edits stay on your machine unless you deliberately make the server accessible to other devices.

> Jamloom is an evolving prototype, not a production-hardened public service. See [Limitations and safety](#limitations-and-safety) before exposing it to a network.

## Features

- **Local track library** — keep processed tracks, search and sort the library, edit song metadata, and manage disk usage.
- **Stem separation** — use Demucs to create backing tracks and individual instrument stems; play, mix, mute, solo, and download stems.
- **Practice controls** — seek, loop a section, adjust playback speed, and use the metronome. Supported mobile browsers can keep the screen awake during playback.
- **Editable note arrangements** — inspect automatically detected bass/guitar notes, edit pitch and timing, and add or remove tones. Save changes separately from the original analysis.
- **Guitar and bass tablature** — view detected notes on a six-string guitar or four-string bass fretboard. Edit string and fret positions; a chosen position determines the note pitch. Chord tones can share a playback-time column.
- **Local persistence** — processed tracks and saved arrangements remain in the library across server restarts.

Automatic pitch analysis is a suggestion, not guaranteed transcription. Chords, distortion, fast passages, harmonics, and separation artifacts can produce missing or incorrect notes. MusicXML parsing/import code is retained for possible future score-to-audio alignment research, but MusicXML is not currently exposed in the UI.

## Requirements

- Linux is the primary development environment; Python 3.10–3.12 is recommended.
- FFmpeg (`ffmpeg` executable).
- PyTorch compatible with your hardware, plus Demucs.
- Sufficient disk space for uploads, model weights, separated stems, backing mixes, and note data.

## Install on Arch Linux

Install system packages and create a virtual environment:

```bash
sudo pacman -S --needed python python-pip ffmpeg
cd jamloom
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
```

Install a PyTorch build compatible with your hardware. For AMD GPUs, follow the current [PyTorch installation selector](https://pytorch.org/get-started/locally/) and check compatibility with your GPU and ROCm stack. Then install Jamloom's Python dependencies and Demucs:

```bash
python -m pip install -r requirements.txt
python -m pip install demucs
python -c 'import torch; print("PyTorch:", torch.__version__, "HIP:", torch.version.hip, "GPU available:", torch.cuda.is_available())'
```

## Run

From the project directory, with the virtual environment activated:

```bash
uvicorn app:app --host 127.0.0.1 --port 8000
```

Open <http://127.0.0.1:8000> in your browser. The first separation may download model weights; later runs can reuse them.

To access Jamloom from another device on your local network, bind Uvicorn to a suitable LAN interface, for example `--host 0.0.0.0`, and configure your firewall accordingly. Do not expose this prototype directly to the public internet.

## Data and settings

- The shared library is stored in `data/library/` (or `$JAMLOOM_DATA/library/`). It contains original uploads, generated mixes, stems, metadata, note analysis, and saved arrangements.
- Back up this directory if you want to preserve your library when moving or reinstalling Jamloom.
- Some practice preferences are stored in browser local storage and are specific to that browser profile.
- When installing an update over an existing copy, preserve `data/library/`.

## Limitations and safety

- Jamloom has no user accounts, production-grade access controls, or public-service hardening. Anyone who can reach an exposed instance may be able to interact with its library and APIs.
- The automatic note detector can be inaccurate and is not a substitute for checking the notes by ear or against a score.
- Session coordination code remains in the project, but shared playback does not transport live instrument audio and is not a complete remote-jamming system.
- Review copyright obligations for audio you process, and verify the licenses and terms for dependencies, FFmpeg builds, and pretrained model weights before any commercial use.

## License

Jamloom's own source code is licensed under the MIT License; see [LICENSE](LICENSE). Third-party dependencies and pretrained model weights are governed by their own licenses and terms.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.


Latest release: **0.4.39** auditions exactly the selected note duration from its instrument stem while keeping the main player paused. See [CHANGELOG.md](CHANGELOG.md).
