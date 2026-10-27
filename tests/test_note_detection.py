"""Regression tests for note reconstruction from a separated instrument stem.

Run with: .venv/bin/python -m unittest discover -s tests
"""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import analyze_pitch_track  # noqa: E402

SAMPLE_RATE = 44100
TOLERANCE_SECONDS = 0.03


def tone(frequency: float, duration: float, amplitude: float = 0.3, fade: float = 0.008) -> np.ndarray:
    times = np.arange(int(SAMPLE_RATE * duration)) / SAMPLE_RATE
    envelope = np.minimum(1.0, np.minimum(times / fade, (duration - times) / fade))
    return (amplitude * np.sin(2 * np.pi * frequency * times) * envelope).astype(np.float32)


def silence(duration: float) -> np.ndarray:
    return np.zeros(int(SAMPLE_RATE * duration), dtype=np.float32)


def build(*parts: np.ndarray) -> np.ndarray:
    return np.concatenate(parts)


class NoteDetectionTests(unittest.TestCase):
    def analyse(self, samples: np.ndarray, stem: str = "guitar") -> list[dict]:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "stem.wav"
            sf.write(path, samples, SAMPLE_RATE)
            return analyze_pitch_track(path, stem)["events"]

    def test_onset_lands_on_the_attack_after_leading_silence(self):
        events = self.analyse(build(silence(1.2), tone(220.0, 0.4), silence(0.4)))
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["note"], "A3")
        self.assertAlmostEqual(events[0]["start"], 1.2, delta=TOLERANCE_SECONDS)

    def test_trailing_silence_is_not_part_of_the_note(self):
        events = self.analyse(build(silence(1.2), tone(220.0, 0.4), silence(0.6)))
        self.assertEqual(len(events), 1)
        self.assertAlmostEqual(events[0]["end"], 1.6, delta=0.06)

    def test_repeated_pitch_notes_are_kept_apart(self):
        audio = build(silence(0.3), tone(440.0, 0.5), silence(0.5), tone(440.0, 0.5), silence(0.3))
        events = self.analyse(audio)
        self.assertEqual([event["note"] for event in events], ["A4", "A4"])
        self.assertAlmostEqual(events[0]["start"], 0.3, delta=TOLERANCE_SECONDS)
        self.assertAlmostEqual(events[1]["start"], 1.3, delta=TOLERANCE_SECONDS)

    def test_note_starts_track_the_played_attacks(self):
        pieces = [silence(0.2)]
        expected = []
        cursor = 0.2
        for frequency in (440.0, 493.88, 523.25, 587.33):
            pieces.append(tone(frequency, 0.3))
            expected.append((cursor, round(69 + 12 * np.log2(frequency / 440.0))))
            cursor += 0.45
            pieces.append(silence(0.15))
        pieces.append(silence(0.3))
        events = self.analyse(build(*pieces))
        self.assertEqual([event["midi"] for event in events], [midi for _, midi in expected])
        for event, (start, _) in zip(events, expected):
            self.assertAlmostEqual(event["start"], start, delta=TOLERANCE_SECONDS)

    def test_short_notes_are_not_merged(self):
        pieces = [silence(0.2)]
        expected = []
        cursor = 0.2
        for frequency in (220.0, 246.94, 261.63, 293.66, 329.63, 349.23):
            pieces.append(tone(frequency, 0.12, fade=0.004))
            expected.append(cursor)
            cursor += 0.24
            pieces.append(silence(0.12))
        pieces.append(silence(0.3))
        events = self.analyse(build(*pieces))
        self.assertEqual(len(events), len(expected))
        for event, start in zip(events, expected):
            self.assertAlmostEqual(event["start"], start, delta=TOLERANCE_SECONDS)

    def test_events_never_overlap_or_run_backwards(self):
        audio = build(silence(0.2), tone(110.0, 0.6), silence(0.1), tone(146.83, 0.5), silence(0.4))
        events = self.analyse(audio, stem="bass")
        for event in events:
            self.assertLess(event["start"], event["end"])
        for earlier, later in zip(events, events[1:]):
            self.assertLessEqual(earlier["end"], later["start"] + 1e-6)


if __name__ == "__main__":
    unittest.main()
