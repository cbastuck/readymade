# Trigger Pad

Three services: record audio, chop it into pads, play them back. The shortest
board here that is a usable instrument.

## What it does

It captures microphone audio in two-second slices and lays them out as
triggerable pads. Hit a pad and that slice plays.

## How it works

One [browser runtime](../concepts/runtime.md).

1. **Audio Input**, from [Audio IO](../services/audio-io.md), records with a
   `timeslice` of 2000 ms — so the stream arrives as two-second chunks rather
   than one continuous buffer. That chunk size *is* the pad length.
2. [Trigger Pad](../services/trigger-pad.md) holds the slices and emits one when
   a pad is hit.
3. **Audio Output**, also from [Audio IO](../services/audio-io.md), plays it.

## Why it is this short

Almost all of the behaviour is a single configuration value. `timeslice`
decides what a pad contains, and the rest is two services that already know how
to record and play. Nothing here slices anything — the recorder was asked to
produce chunks, so chunks are what travel down the chain.

## Try it

It needs microphone permission. Let it record for a few seconds, then hit the
pads.
