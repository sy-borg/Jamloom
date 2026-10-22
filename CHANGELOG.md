## 0.4.43
- Removed legacy `STEMFORGE_DATA` and `STEMFORGE_MAX_UPLOAD_BYTES` environment-variable fallbacks; Jamloom now uses only the corresponding `JAMLOOM_` variables.

## 0.4.42
- Added a visual-only muted-string toggle for guitar/bass note events. The tab displays `x`; pitch, frequency, and playback remain unchanged, and the marker is saved with the arrangement.

## 0.4.39
- Note auditions now play exactly the selected note's recorded start-to-end duration, with no lead-in or tail margin and no minimum-length extension.

## 0.4.38
- Fixed note selection so the editor remains open while the player stays paused.
- Clicking a note always seeks the main timeline to that note. Only when the player is paused, Jamloom briefly auditions the selected instrument stem with a little margin before and after the note, without switching the main player to Playing. This also works while the backing mix is selected.
- Starting normal playback or changing the selected instrument stops any isolated stem audition.

## 0.4.37
- Clicking a detected note seeks to its original audio position and briefly plays that audio excerpt, then pauses at the note end (with a short minimum audition length for very brief notes). Works with backing-mix and stem-mixer playback without synthesizing a tone.

## 0.4.36
- Keeps supported mobile screens awake during playback using the Screen Wake Lock API; releases the lock on pause/end and reacquires it when returning to the app during playback. Unsupported browsers continue normally.

## 0.4.35
- Replaced the generic loaded-track subtitle with song metadata (artist, album, BPM, time signature and duration when available).
- Made the loaded song title more prominent in a distinct heading panel.
- Updated the browser tab title to include the loaded song, its metadata, and Playing / Paused / Ended status.

## 0.4.34
- Replaced text labels on the practice transport with Unicode playback glyphs and accessible button labels.
- Added a jump-to-beginning control and increased transport button height for easier touch use.

## 0.4.33
- Fixed "Use backing mix" showing 0:00 / 0:00 and playing nothing on mobile: paused stems kept downloading and used up the browser's connection limit, so the backing-mix request never started. Stems now release their connections while the backing mix is active and reload when you switch back to the stem mixer.

## 0.4.32
- Fixed unreliable slider, time display, and note/fretboard updates on phones and tablets. In stem-mixer mode the muted main player was streaming the full backing mix over the network and could stall while the stems kept playing; it is now a locally generated silent clock with no network dependency. Switching to "Use backing mix" swaps back to the real backing track at the same position and speed.
- The seek slider no longer relies on `:active` (which can stay set on touch screens and freeze the slider); dragging is tracked explicitly.
- Playback UI refreshes immediately when the page becomes visible again.

## 0.4.31
- Fixed instrument selection never reaching the server on phones and tablets: stem `<audio>` elements now start with `preload="none"`, so large WAV downloads can no longer occupy the browser's per-host connection limit and leave the note GET queued until it times out. Stem loading is released once the note requests have completed (or after 10 seconds).
- Note requests are now issued before the stem audio elements are created, and the other instrument's notes are prefetched, so switching instrument is served from memory without a network request. The cache is cleared when notes are re-analyzed or an arrangement is saved.

## 0.4.30
- Start the note-suggestion GET request before clearing/re-rendering note UI, so expensive mobile rendering cannot prevent the request from being issued.
- Handle native-select `input` and `change` events directly without deferring or suppressing either event; newer requests abort older ones.

## 0.4.29
- Reworked note-onset grouping to use a map, reducing fretboard/tab rendering from quadratic to linear grouping work for long note arrangements.
- Made mobile instrument selection respond to both `input` and `change`, deferring the handler until the selected value settles and deduplicating repeated events.
- Corrected the note-loading timeout message to match the configured 60-second timeout.

## 0.4.28
- Fixed note-loading errors so HTTP 404 responses are not mistaken for pending analysis; the server's actual error is shown.
- Increased the note-suggestion request timeout to accommodate larger event payloads on mobile networks.
- Replaced playback UI animation-frame polling with a lightweight timer so the time display, seek slider, detected notes, and fretboard continue updating on mobile browsers that throttle animation frames.

# Changelog

## 0.4.27
- Added a 15-second timeout and explicit recovery message for note-analysis GET requests that stall, and disabled caching for these requests.
- Simplified mobile instrument selection to the native `change` event to avoid intermediate or duplicate requests.
- Updated the playback clock and seek slider from the same animation-frame loop as note/fretboard highlighting, while keeping seek/seeked updates immediate.

## 0.4.26
- Made instrument selection respond to either native-select `input` or `change` events, with duplicate-event protection, so mobile selection reliably triggers note-analysis loading.
- Added a lightweight animation-frame update while playback is running to keep note and fretboard highlighting synchronized on mobile browsers with throttled `timeupdate` events.


Notable changes by release. Earlier versions introduced the core stem-separation, practice, and library workflows; this file records the main milestones and recent refinements.

## 0.4.25
- Cleaned up the README and moved release history into this changelog.

## 0.4.24
- Made arrangement string/fret validation explicitly select the open-string MIDI table by stem (`bass` or `guitar`) and return an instrument-specific validation message.

## 0.4.23
- Made string and fret selection determine the selected note pitch. Changing either position updates the pitch field and shows the resulting frequency.

## 0.4.22
- Clarified note-level versus chord/arrangement editing controls.
- Preserved chord-tone metadata when saving arrangements and adjusted bass position validation.

## 0.4.21
- Removed the MusicXML panel from the visible UI while preserving its parsing, import API, and rendering code for possible future alignment work.

## 0.4.20
- Fixed note-event CSS specificity so `.note-event-line` retains its flex layout.

## 0.4.19
- Corrected note-button line styling to prevent generic span rules from interfering with the compact two-line layout.

## 0.4.18
- Split note-button labels into two lines: pitch and fretboard position, then frequency and timestamp.

## 0.4.17
- Prevented note-button labels from wrapping and widened aligned timeline columns.

## 0.4.16
- Matched fretboard chord-highlight width to the note-button width while retaining shared timeline spacing and scrolling.

## 0.4.15
- Hid the note editor by default; it opens on note selection while paused and closes on playback start or successful save.
- Aligned note buttons and fretboard columns under one horizontal scrollbar.

## 0.4.14
- Added a four-string bass tablature view alongside the six-string guitar view, with bass tuning and synchronized playback highlighting.

## 0.4.13
- Synchronized active-chord highlighting between note buttons and tablature, with stronger cyan highlighting.

## 0.4.12
- Improved active-note highlighting and grouped notes with matching onset times into tab columns.
- Added an action to add an editable chord tone at the selected note's timing or the playhead.

## 0.4.11
- Added audio-aligned six-string guitar tablature based on detected note events, with editable string/fret positions.

## 0.4.10
- Added per-track MusicXML score tempo and audio-offset controls, saved in browser storage.

## 0.4.9
- Added MusicXML import, part selection, and a measure strip synchronized approximately with playback. Uncompressed partwise `.musicxml` and `.xml` were supported; `.mxl` and timewise MusicXML were not.

## 0.4.8
- Added the MIT license for Jamloom source code, copyright 2026 Jamloom contributors.

## 0.4.6–0.4.7
- Added library storage summaries, per-track size information, deletion confirmation, and incremental library listing with search and sorting.

## 0.4.4–0.4.5
- Consolidated song metadata editing into a dialog and improved library sorting, searching, and pagination.

## 0.4.3
- Added the Jamloom favicon with SVG and ICO assets.

## 0.4.1–0.4.2
- Added a saved editable note-arrangement layer separate from original automatic analysis; polished note-button focus/hover styling.

## 0.3.8–0.4.0
- Added automatic bass/guitar note analysis after stem separation, saved analysis results, and improved pitch estimates with octave correction and frequency display.

## 0.3.6–0.3.7
- Introduced touch-friendly Practice Mode, transport and seek controls, loop support, and metronome synchronization refinements. Hid the unfinished session panel while retaining its implementation.

## 0.3.1–0.3.5
- Reorganized the app around the persistent library and practice mixer; added editable song metadata, BPM/time-signature metadata, and metronome improvements.

## 0.2.4–0.2.8.1
- Built the stem mixer, master volume, solo/mute controls, playback shortcuts, metronome, persistent processed-track library, and browser-local practice settings; fixed a library save bug.

## Early prototype
- Added upload and Demucs separation, backing-track playback and downloads, practice transport controls, and an initial session-coordination API using invite-code rooms and WebSockets. Session coordination does not itself provide live audio transport or a fully synchronized remote performance.
