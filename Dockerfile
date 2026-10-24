FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    JAMLOOM_DATA=/data \
    TORCH_HOME=/models

WORKDIR /app

# Install OS dependencies as root
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt

# Install Python dependencies as root
RUN python -m pip install --upgrade pip \
    && python -m pip install \
       --index-url https://download.pytorch.org/whl/cpu \
       torch torchaudio \
    && python -m pip install -r requirements.txt demucs

# Create the application user and prepare writable directories
RUN useradd --create-home --shell /bin/bash appuser \
    && mkdir -p /data /models \
    && chown -R appuser:appuser /app /data /models

COPY --chown=appuser:appuser . .

VOLUME ["/data", "/models"]
EXPOSE 8000

USER appuser

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]