# StemForge

A local-first prototype for turning a user's audio into a backing track using Demucs. It provides a browser UI, background separation jobs, instrument removal, playback, and WAV downloads.

## Requirements

- Linux, Python 3.10–3.12 recommended
- FFmpeg (`ffmpeg` executable)
- A compatible PyTorch install and Demucs
- Enough disk space for the uploaded track, model weights, separated stems, and output

## Install on Arch Linux (recommended isolated environment)

Install system prerequisites:

```bash
sudo pacman -S --needed python python-pip ffmpeg
```

Create a virtual environment. On Arch, use a venv rather than installing Python packages into the system Python:

```bash
cd stemforge
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
```

Install PyTorch for your hardware using the current official instructions at https://pytorch.org/get-started/locally/ . For a CPU-only test, `python -m pip install torch torchaudio` may be sufficient depending on the current Python/PyTorch wheel matrix. Then install the app dependencies and Demucs:

```bash
python -m pip install -r requirements.txt
python -m pip install demucs
```

Check that the environment can import the libraries:

```bash
python -c 'import torch, demucs, soundfile; print("torch", torch.__version__, "CUDA", torch.cuda.is_available())'
```

Start the web app:

```bash
uvicorn app:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000 in Firefox. The first separation downloads the model weights, so it needs an internet connection. Later processing can run locally without sending audio to a third-party service.

## Models

- `htdemucs`: standard four stems: vocals, drums, bass, other.
- `htdemucs_6s`: experimental six stems: vocals, drums, bass, guitar, piano, other.

The six-stem model is more useful for guitar practice but is experimental and can produce artifacts. The app removes one selected stem from the mix. It currently chooses a single stem to remove in the UI; the backend can accept comma-separated stem names.

## Important prototype limitations

- This is a single-user local prototype, not safe to expose directly to the internet.
- Jobs and metadata live in memory; restarting the server clears the job list, although files remain on disk.
- There is no authentication, quotas, job queue persistence, or automatic cleanup yet.
- Uploaded files are extension-checked and size-limited, but production deployment needs stronger content validation, malware/resource controls, storage isolation, per-user authorization, retention/deletion controls, rate limiting, and reverse-proxy limits.
- Demucs separation can be slow on CPU. GPU support depends on the PyTorch build and hardware. Verify model and weight licensing before commercial use.
- Mixing stems can change the sound compared with the original mix; peak limiting here is simple headroom scaling, not mastering.

## Next steps

1. Test on several short tracks and inspect separation quality.
2. Add checkboxes to remove multiple stems, plus per-stem volume controls.
3. Add waveform and loop playback.
4. Add BPM / beat estimation and later chord or note visualization.
5. Before public deployment, move processing into a persistent task queue and add accounts, isolated storage, quotas, cleanup, and commercial licensing review.
