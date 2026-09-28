# Trigger Pad Recorder

The [Trigger Pad](./triggerpad-board.md) board with a recorder in it: play the
pads, record what you play, and play the take back.

## What it does

Hits go straight to the speaker, as on the Trigger Pad. Press record and play
on the Recorder, and every hit is also kept at the moment it was played. Stop,
play again, and the take plays back as it was played, faster or slower if you
change the Recorder's speed. Record a second time over it to add to the take
(`overdub`), or to play it again from scratch (`replace`).

## How it works

One [browser runtime](../concepts/runtime.md).

1. **Audio Input** and [Trigger Pad](../services/trigger-pad.md) work as on the
   Trigger Pad board: two-second slices of the microphone, laid out as pads.
2. **Recorder** is a [Timeline](../services/timeline.md) keeping its own clock.
   It does not know it is fed by pads. Whatever arrives at its input is an
   action happening now: it leaves in the frame for that moment, and while
   recording it stays on the timeline at that moment. The Recorder is
   unbounded and emits 60 frames a second, so a hit plays back at most a
   sixtieth of a second late.
3. **On a hit**, a [Filter](../services/filter.md), lets through only the
   frames with an action in them. The Recorder emits a frame 60 times a
   second whether anything is due or not.
4. **The hit**, a [Map](../services/map.md), takes the action out of the frame,
   so the speaker is given the audio itself.
5. **Audio Output** plays it.

## Looping a part of a take

Drag across the strip above the Recorder's ruler to mark a loop range. The
Recorder then repeats that stretch. Record in `overdub` to layer more hits
onto it pass after pass, or in `replace` to play each pass anew. Press the
range to switch looping off, and the whole take plays again.

## Things to know

- Anything that reaches the Recorder while it records is recorded, including
  the microphone's slices if Audio Input is still recording. Stop the
  microphone once the pads are filled.
- The Map takes the first action of a frame. Two hits within a sixtieth of a
  second of each other land in one frame, and only the first sounds.
- A take lasts only while the board is open: audio is not saved with the board.

## Try it

It needs microphone permission. Fill the pads, stop the microphone, then press
record and play on the Recorder and play a pattern. Press stop, then play.
