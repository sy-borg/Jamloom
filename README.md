# Jamloom MVP 0.2.8.1

A local-first AI music practice prototype. Upload a track, use Demucs to separate instruments, and play along with a backing track. The prototype also includes a first **session coordination server** for invite-code rooms and shared playback state.

## Current capabilities

- Browser UI for audio upload and Demucs separation.
- Four-stem (`htdemucs`) and experimental six-stem (`htdemucs_6s`) models. The selected model determines how many instruments appear in the mixer; all stems are included in the generated full mix.
- Backing-track playback and WAV download, plus individual stem downloads. Practice controls include ±5-second navigation, A/B section looping, selectable playback speed, and BPM-based speed calculation. Playback-rate adjustment preserves pitch in supported browsers.
- Create a session, join with a six-character invite code, see participants, and broadcast shared playback state over WebSockets. Static assets use a versioned URL to avoid stale browser-cache issues. Hosting and joining are separate UI paths; the invite-code field only appears after choosing to join.
- Session state currently includes track job ID, play/pause, position, loop points, BPM, and excluded stems.

**Not implemented yet:** streaming live microphone/instrument audio, automatic audio-player synchronisation between session participants, recording a multi-person performance, accounts, persistent sessions, or production-grade access controls.

## Requirements

- Linux, Python 3.10–3.12 recommended
- FFmpeg (`ffmpeg` executable)
- A compatible PyTorch install and Demucs
- Enough disk space for the uploaded track, model weights, separated stems, and output

## Install on Arch Linux

```bash
sudo pacman -S --needed python python-pip ffmpeg
cd jamloom
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
```

Install a PyTorch build compatible with your hardware. For an AMD GPU, use the current PyTorch ROCm installation instructions at https://pytorch.org/get-started/locally/ and verify compatibility with your GPU and installed libraries. Then:

```bash
python -m pip install -r requirements.txt
python -m pip install demucs
python -c 'import torch; print("PyTorch:", torch.__version__, "HIP:", torch.version.hip, "GPU available:", torch.cuda.is_available())'
```

Start the app:

```bash
uvicorn app:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000. The first separation downloads model weights; subsequent separation can run locally.

## Try session coordination

1. Open Jamloom in one browser and create a session.
2. Copy the six-character invite code.
3. Open Jamloom in another browser (or another device that can reach this server), enter a display name and invite code, and join.
4. Use **Share Play**, **Share Pause**, or change the shared position/BPM. Connected browsers receive the updated session state.

The current UI demonstrates coordination, but does not yet automatically control each browser's audio element. For a second device on your LAN, run Uvicorn bound to an appropriate LAN interface and ensure your firewall allows access; do not expose this prototype directly to the public internet.

### Session API

- `POST /api/sessions` — create a session (`title`, `display_name`, optional `track_job_id`)
- `POST /api/sessions/join` — join with `invite_code` and `display_name`
- `GET /api/sessions/{session_id}` — fetch state (send `X-Participant-Token`)
- `POST /api/sessions/{session_id}/state` — update shared state (send `X-Participant-Token`)
- `DELETE /api/sessions/{session_id}/participants/me` — leave the session
- `WS /api/sessions/{session_id}/ws?token=...` — receive snapshots/updates and send `{"type":"state_update","state":{"playing":true}}`

The server provides a shared state clock (`state.updated_at`) in Unix seconds. A future synchronised player can estimate the current play position as `position_seconds + (server_now - updated_at)` while `playing` is true, then periodically correct drift. This is groundwork, not a claim of low-latency remote jamming.

## Data and security limitations

- Session records, participant tokens and connection state are in memory; restarting the process clears all active sessions. Use one server process only for this version.
- Participant tokens are bearer secrets. Anyone with a participant token can read and update that session's shared state. Don't log or share tokens.
- There is no user account system, rate limiting, session expiry, persistent store, or production-grade abuse protection.
- Session coordination does not transport live instrument audio. A future live-jam feature will need dedicated low-latency media transport and careful latency testing; the current HTTP/WebSocket server is not sufficient by itself.
- The shared song library is persisted under `data/library/` (or `$JAMLOOM_DATA/library/`) and restored when the server restarts. Practice settings are saved per track in the browser local storage, so they are specific to that browser profile.
- Verify model-weight licensing and copyright requirements before offering a commercial hosted service.


## Version 0.2.4

Adds an in-browser stem mixer: individual Demucs stems can be balanced with volume sliders or muted independently. The main backing-track player remains the master transport, so playback, seeking, looping, and playback speed are synchronized across stems. The mixer is always visible after processing and is the default playback mode. The full backing mix remains available as an alternative, and each stem can still be downloaded.


## Version 0.2.5

Removes the upload-time instrument-to-remove selection. The selected Demucs model determines whether four or six stems are produced, and the generated backing mix includes all stems. The in-browser mixer is always visible after processing and is active by default; users can switch to the full backing mix without hiding the mixer.

## Version 0.2.7

Polishes the practice mixer with a master-volume control (default 75% for extra output headroom), individual Solo buttons that temporarily isolate one stem without overwriting its mute state, and clearer active-loop styling. Mixer levels and mute choices remain in place when switching between the stem mixer and full backing mix. Adds keyboard shortcuts when focus is outside form controls: Space play/pause, Left/Right arrows seek five seconds, A/B set loop points, and L toggles looping.


## Jamloom 0.2.7

- Playback-rate changes enable the browser's native pitch-preservation feature where supported.
- A metronome appears as a separate mixer track after stem separation, with manual BPM, volume, mute, and solo controls. Its beat grid follows the master player's timeline, so its effective BPM scales with playback speed.
- The metronome click is generated locally with the Web Audio API; it is not a rendered/downloadable stem.


## Jamloom 0.2.8

- Adds a persistent shared library of processed tracks. Successful separations save the original upload, backing mix, separated stems, and metadata under `data/library/<track-id>/`. The library is shared by every browser using the same Jamloom server and survives server restarts.
- The library lists track name, duration, separation model, and date, and allows tracks to be reopened or permanently deleted.
- Per-track practice settings are remembered in each browser profile: master volume, playback speed, loop points and loop enabled state, stem levels/mutes, and metronome BPM/level/mute. These settings are browser-local; the audio files are server-shared.
- Existing session coordination and audio practice features are retained. BPM/time-signature detection and beat/accent synchronization remain future work.


## Jamloom 0.2.8.1

Bugfix release: avoid passing `status` twice when a separation completes and the resulting track is added to the persistent library.
