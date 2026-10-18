# Changelog

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
