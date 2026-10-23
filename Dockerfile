# CPU-focused container image for Jamloom. GPU/ROCm passthrough is intentionally
# left to host-specific setups; the normal app works without GPU acceleration.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    JAMLOOM_DATA=/data \
    TORCH_HOME=/models

WORKDIR /app

# FFmpeg is used by audio tooling; libsndfile is required by python-soundfile.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt

# Install CPU-only PyTorch first so pip does not pull CUDA libraries into the
# image. Demucs and Jamloom dependencies are then installed into the same env.
RUN python -m pip install --upgrade pip \
    && python -m pip install --index-url https://download.pytorch.org/whl/cpu torch torchaudio \
    && python -m pip install -r requirements.txt demucs

COPY . .

# Keep writable user data and downloaded model weights outside the image.
RUN mkdir -p /data /models
VOLUME ["/data", "/models"]
EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
