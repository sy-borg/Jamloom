## Version 0.4.14
- Added a four-string bass tablature view using standard bass tuning (G–D–A–E, high to low), alongside the existing six-string guitar tab.
- Bass note positions use bass tuning when suggesting and validating string/fret assignments; switching the instrument updates the string editor.
- The same timing and current-chord highlighting is used for bass and guitar. Existing note timing remains unchanged.

## Version 0.4.13

- Synchronized highlighting across the active chord: all note buttons sharing the current onset highlight together, matching the corresponding tablature column.
- Strengthened the fretboard/tab highlight with a bright chord-tone marker, cyan column background, and clearer button glow.

## Version 0.4.12

- Improved guitar-tab playback highlighting with a brighter, higher-contrast active note.
- Notes sharing the same onset are grouped into one tab column, allowing chord tones to appear vertically together.
- Added “Add chord tone” to create another editable note at the selected note’s timing (or at the playhead if no note is selected). Set its pitch and guitar position, then save the arrangement.

## Version 0.4.11

- Added an audio-aligned six-string guitar tablature view based on detected guitar note events.
- Shows suggested standard-tuning string/fret positions; positions can be edited per note and saved with the arrangement.
- Guitar string/fret choices are validated against the note pitch. Audio timestamps remain authoritative; imported-score tempo alignment is not used for this view.

## Version 0.4.10

- Added per-song MusicXML timing adjustment: editable score tempo and audio offset, saved in the current browser. This helps align a score whose tempo is unknown or differs from the recording. Positive offset places the score later in the audio; Reset restores the imported tempo and zero offset.

## Version 0.4.9

- Added MusicXML import for an open library track, with part selection and a measure strip synchronized to playback. Preserves guitar string/fret data when present; clicking a measure seeks to its approximate start. Uncompressed partwise `.musicxml` and `.xml` are supported; compressed `.mxl` and timewise MusicXML are not supported yet.

## Version 0.4.8

- Added the MIT License for Jamloom source code, copyright 2026 Jamloom contributors. Third-party dependencies and pretrained model weights retain their own licensing terms.

## Version 0.4.3

- Added Jamloom favicon (SVG with ICO fallback) and linked it from the app page.

# Jamloom 0.4.1

A local-first AI music practice prototype. Upload a track, use Demucs to separate instruments, and play along with a backing track. The prototype also includes a first **session coordination server** for invite-code rooms and shared playback state.

## Current capabilities

- Library-first practice workspace: the shared song library and mixer are the main page; the separator opens only when creating a new backing track.
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
- The shared song library is persisted under `data/library/` (or `$JAMLOOM_DATA/library/`) and restored when the server restarts. Track title, artist and album metadata can be edited and are shared on the server. Library search and sorting are available. Practice settings are saved per track in browser local storage, so they are specific to that browser profile.
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


## Jamloom 0.3.1

- Reorganises the home screen around the shared library and practice mixer.
- Adds library search and sorting by recently added, title, artist, album, or duration.
- Adds editable title, artist, and album metadata; this metadata is stored with the library track and shared across browsers.
- The separator is hidden until **Create backing track** is selected. Successful processing saves the track and opens it in the mixer. Existing library audio and browser-local practice settings are retained.


Jamloom 0.3.1 adds editable BPM and time-signature metadata to library tracks. When a track has a BPM, it pre-fills the Original BPM field in the tempo controls. Values remain manually editable; automatic detection is planned for a future release.


## Jamloom 0.3.2

- The metronome uses saved track BPM as its initial pulse rate when that value is within the supported 30–300 BPM range; browser-local metronome settings still take precedence when restored.
- Metronome accents follow the saved time signature: the first pulse is strong, 4/4 also gives beat 3 a lighter accent, and compound meters such as 6/8, 9/8 and 12/8 group eighth notes in threes and accent the larger pulse.
- For compound meters with an eighth-note denominator, metronome BPM is interpreted as dotted-quarter pulses per minute. For other meters, BPM is the manually chosen metronome beat rate.
- The metronome remains aligned to the media timeline and follows playback speed, seeking and looping. Tracks without a time signature use a default 4/4 accent pattern without changing their saved metadata.


## Jamloom 0.3.3

- Fix metronome scheduling for slow pulses and compound meters such as 6/8. Normal forward updates of the media clock no longer repeatedly reset the beat grid; large jumps and seeking still realign it.


## Jamloom 0.3.4

- Reworks metronome click scheduling to use the Web Audio clock instead of repeatedly deriving click timing from media-clock updates. This is intended to prevent the metronome from stopping after only a few clicks when media-time updates arrive irregularly.
- The song position is still used to align the beat grid when starting or resetting; seeking and playback-speed changes re-align the metronome.
- Missed beats after a browser timer pause are skipped instead of firing as a burst when the timer resumes.


## Metronome synchronization (0.3.6)

The mixer metronome provides **Set downbeat** to anchor beat 1 at the current playback position, and **Reset cycle** to make the next metronome pulse beat 1. The downbeat offset is saved with that song's browser-specific practice settings and restored when the song is reopened in the same browser. The offset is measured in audio timeline seconds, so playback-speed changes do not change the saved anchor.


### Practice Mode (0.3.6)
- Added a touch-friendly Practice Mode with larger transport controls and a seek slider.
- Added a note-display placeholder to establish the layout for future instrument-stem pitch analysis; no notes are fabricated or detected in this release.
- Toggle between Practice Mode and the full mixer at any time. The preference is remembered in the current browser.


## 0.3.7

- Hidden the unfinished Jam session panel from the interface for now. The existing session UI markup, client-side code, API and server implementation are retained for future development.

## Version 0.3.8

Adds experimental, local pitch estimation for separated bass and guitar stems. After separation, Jamloom automatically analyzes available bass and guitar stems in the background; playback is available immediately. Results are saved beside the library track and reused when the track is reopened. You can rerun analysis manually if needed. The current note and a short strip of nearby detected notes follow the playback position, and tapping a note seeks to its timestamp. This lightweight autocorrelation-based estimator is intended for mostly monophonic lines; it is not polyphonic transcription or verified sheet music. Notes may be missed or misidentified, especially with chords, fast passages, distortion, harmonics, or separation artifacts. Analysis is limited to the first 15 minutes of a stem. NumPy and SoundFile are already part of the app requirements.


## Version 0.4.0

- Improved bass/guitar pitch estimates with a conservative spectral check for octave-low detections.
- Corrected isolated one-frame octave flips when the neighboring frames agree.
- Displayed estimated frequency in Hz beside each detected note to help diagnose octave errors.
- Existing saved note-analysis JSON files remain readable, but rerun analysis on a stem to benefit from the improved detector.


## 0.4.0 — Automatic note suggestions

After Demucs separation finishes and the backing mix is saved, Jamloom analyzes available bass and guitar stems in the background. Playback is available immediately; note analysis does not block the practice workflow. Results and per-stem analysis status are saved with the library track. If analysis fails, the separated track remains usable and the user can retry manually.


## Version 0.4.1

- Added an editable note-arrangement layer separate from automatic pitch-analysis suggestions.
- Users can select a detected note, change its pitch and start/end times, add a note at the playhead, or delete a note.
- Saved arrangements persist with the library track and stem, and load in place of suggestions on subsequent opens. The original automatic analysis file is not overwritten.
- Arrangement changes are drafts until the user explicitly saves them.


## License

Jamloom's own source code is licensed under the MIT License; see `LICENSE`. Third-party dependencies, FFmpeg builds, and pretrained model weights are subject to their respective licenses and terms. Licensing of pretrained Demucs weights is separate from the Demucs source-code license; review the applicable terms before any commercial use.


## 0.4.11
- Added an audio-aligned six-string guitar tablature view based on detected guitar note events.
- Shows suggested standard-tuning string/fret positions; positions can be edited per note and saved with the arrangement.
- Guitar string/fret choices are validated against the note pitch. Audio timestamps remain authoritative; imported-score tempo alignment is not used for this view.
