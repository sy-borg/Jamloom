# Jamloom

* Name: Jamloom
* Initial product: Browser-based AI music practice and backing-track tool.
* Technology: Python backend, Demucs, PyTorch with ROCm, running locally on Arch Linux.
* Long-term vision: Hosted commercial service with a free tier, self-hosting support, and collaborative jam sessions.
* Immediate priority: Make the single-player practice workflow excellent before expanding.

## Timeline

* Today: Upload a song, mute guitar and bass, and jam with friends in the same room.
* Next: Add looping, tempo control, a metronome and better practice tools.
* Eventually: Invite friends online, synchronise playback, record everyone's parts and mix the result.

## Function

1. User chooses a music track
2. Selects one or more instruments to mute
3. Optional add a metronome to the mix with a user chosen BPM (later default to autodetected BPM)
4. Play the mix, loop rewind/forward X sec, half speed etc.
5. One or more people play along the muted instruments

## Visual

Show one or more of these:

* Display a text representation of the note to play, e.g. D♭
* Display a note sheet
* Guitar tabs

## Ideas

* Multi user. Different people play in different places over the internet and create a mix that can be listened to (even by people not playing with e.g. an invite link) and downloaded at the end.
* Platform need to be flexible: Desktop, Tablet, Mobile. So a website in the browser?
