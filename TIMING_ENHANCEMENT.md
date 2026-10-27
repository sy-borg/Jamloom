# Gaps Between Notes

Notes detected from a stem are not always adjacent: a plucked note decays before
the next attack, so the raw note boundaries leave silence between events.

## What happens

After segmentation, each note is extended into the following silence up to its
midpoint, capped at `MAX_NOTE_HOLD_SECONDS` (0.25 s):

```text
detected:   [==== note 1 ====]              [==== note 2 ====]
                     \______ silence ______/
published:  [======== note 1 ========][======== note 2 ========]
                          midpoint
```

This keeps the tablature and fretboard highlighted while a phrase is held
instead of blinking out between notes.

Two details differ from a naive split-the-gap approach:

- **Attacks are never moved earlier.** Only the end of a note moves. Subtracting
  half the silence from the next note's start would place its attack before it
  was played, which makes highlighting and note auditions start early.
- **The hold is capped at 0.25 s.** A long rest (a break in the arrangement)
  should not become part of the previous note, and Jamloom auditions exactly the
  note's start-to-end range. Without the cap, auditioning a note before a long
  rest would play the rest as well.

Notes therefore never overlap: the held end stops at the midpoint, and the next
note keeps its detected start.
