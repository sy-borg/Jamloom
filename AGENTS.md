# Jamloom Agent Guide

This document provides essential information for agents working with the Jamloom repository to avoid common mistakes and accelerate onboarding.

## Docker Setup

The Jamloom application runs in a Docker container using a non-root user (`appuser`) for security.

### Key Requirements:
- Docker must be installed and running
- Host directory permissions must be properly configured for the non-root user
- When mounting volumes, ensure proper UID/GID mapping (see CHANGELOG.md for details)

### Build and Run:
```bash
docker build -t jamloom .
docker run -p 8000:8000 -v /path/to/data:/data -v /path/to/models:/models jamloom
```

## Python Dependencies

### Core Requirements:
- Python 3.10-3.12 (as specified in Dockerfile)
- PyTorch (CPU-only version for Docker)
- Demucs for stem separation
- FFmpeg for audio processing

### Installation:
```bash
pip install -r requirements.txt
```

## Development Workflow

### Local Development:
1. Create a virtual environment with Python 3.10-3.12
2. Install dependencies with `pip install -r requirements.txt`
3. Run the application with: `uvicorn app:app --host 0.0.0.0 --port 8000`

### Important Directories:
- `/data` - Persistent storage for user library and processed tracks
- `/models` - Persistent storage for Demucs model weights

## Operational Gotchas

### File Permissions:
The Dockerfile creates an `appuser` with UID/GID 1000:1000, so host directories must be owned by this user ID for proper access.

### Environment Variables:
- `JAMLOOM_DATA` - Path to data directory (defaults to `/data`)
- `TORCH_HOME` - Path to PyTorch models (defaults to `/models`)

### Audio Processing:
FFmpeg is required for audio processing and must be installed in the environment.

## Security Notes

- The application is designed for local use only
- Exposing the service to a network requires careful consideration of security implications
- All data remains on the local machine unless explicitly shared