# Note Detection and Timing

Jamloom reconstructs notes from the bass or guitar stem that Demucs separates
from an upload. Both stems are (mostly) monophonic, which makes it possible to
find note boundaries from the audio envelope and use pitch only to label each
note.

## Pipeline

`analyze_pitch_track()` in `app.py` runs five steps.

1. **Downmix and downsample.** The stem is mixed to mono and decimated to about
   11 kHz, which keeps bass fundamentals and guitar harmonics while keeping
   analysis fast.

2. **Pitch track.** Frames of 2048 samples (186 ms) every 512 samples (46 ms)
   are analysed with YIN's cumulative-mean normalised difference. The plain
   autocorrelation peak is *not* used because it latches onto the flank of the
   zero-lag lobe: on a real bass stem that read as 1297 Hz (E6) in roughly a
   third of the frames. Frames without a confident pitch (YIN dip above 0.45,
   i.e. confidence below 0.55) are marked unvoiced.

3. **Onset detection.** A 64-sample RMS envelope is computed over the
   downsampled audio and each hop's rise above the quietest point of the
   preceding ~60 ms is compared against a fraction of the local level. Local
   maxima above that threshold become note attacks, and upward gate crossings
   are always attacks. This finds notes the pitch frames alone cannot separate,
   such as a repeated pitch after a rest or a re-attack inside a sustained note.

4. **Segmentation.** Detected attacks split the timeline into note segments. For
   each segment the voiced frames centred well inside it vote on the pitch
   (confidence-weighted), and the note frequency is the median of the matching
   frames. Short low-confidence runs that straddle a note change are dropped so
   a window covering two notes cannot invent a third pitch.

5. **Refinement.** Each attack is refined from the 5.8 ms envelope hop down to an
   individual audio sample by scanning for the first sample that reaches 25% of
   the attack's peak level. Ends are found from the envelope's release (two
   consecutive quiet hops) rather than from a frame boundary, so trailing
   silence is not part of the last note.

## Accuracy

Measured against synthetic tones with known attack times:

| Case | Expected | Detected |
| --- | --- | --- |
| Single note after 1.2 s silence | start 1.200 s | 1.201 s |
| Repeated pitch, 0.5 s rest | starts 0.300 / 1.300 s | 0.301 / 1.302 s |
| Four notes, 0.3 s each, 0.15 s gaps | 0.200 / 0.650 / 1.100 / 1.550 s | 0.202 / 0.651 / 1.101 / 1.552 s |
| Six notes, 0.12 s each | 0.200 … 1.400 s | 0.201 … 1.401 s |
| Trailing silence after a note | end 1.600 s | 1.614 s |

Real stems keep the same behaviour: no note before the first played attack, no
overlapping events, and the ~1.2 kHz false notes disappear (a sample bass stem
went from 311 events above 1200 Hz to 0).

## Limits

- The stems are treated as monophonic. Chords in the guitar stem are reduced to
  one pitch per attack; a dense part with continuous ringing may therefore
  produce fewer, longer notes.
- Onset sensitivity is controlled by `ONSET_LEVEL_FRACTION` (default 0.35).
  Raising it yields fewer, longer notes; lowering it splits more aggressively.
- Analysis is capped at 15 minutes of audio, as before.

## Tests

`tests/test_note_detection.py` covers attack accuracy, repeated pitches,
trailing silence, short notes, and non-overlapping events:

```bash
.venv/bin/python -m unittest discover -s tests
```
