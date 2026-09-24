# Spectral Modifier

Audio captured on one machine, transformed in the browser, and reconstructed on
another — a three-runtime chain where the middle link is a person moving a
filter around a spectrum.

## What it does

It takes microphone audio on a native runtime, sends the FFT spectrum to the
browser for display and filtering, and sends the filtered spectrum on to a
second native runtime, which turns it back into sound.

## How it works

Three runtimes, and the order is the signal path.

### Audio Input — a realtime runtime

1. **Microphone** (`core-input`) captures audio natively. The browser could
   record too, but this board is about a capture device that is not where the
   interface is.
2. [FFT](../services/fft.md) transforms it into a complex spectrum with a
   512-sample window.

### Spectrum — the browser

1. [Analyzer](../services/analyzer.md) draws the spectrum so you can see it.
2. **Spectral Filter**, a [Filter](../services/filter.md) with an `and`
   aggregator, is where the editing happens — the conditions you set decide
   which frequency bins survive.

### Audio Output — a second realtime runtime

1. [IFFT](../services/ifft.md) inverts the transform, with the same 512-sample
   window.
2. [Monitor](../services/monitor.md).
3. **Speaker** (`core-output`) plays it, in `buffer-incoming` mode so arriving
   frames queue rather than fight.

## Why three runtimes

Because the three jobs want three different places. Capture and playback want
native audio hardware and low latency; the spectrum wants a screen and a mouse.
Splitting them is not an optimisation — the board would not work as well in any
one of the three.

It is also the clearest illustration of what
[crosses a runtime boundary](../concepts/runtime.md#what-crosses-a-runtime-boundary):
what travels between these runtimes is a spectrum, serialised, not audio and not
a function call.

## Try it

It needs two runtimes reachable as `hkp://remotes/realtime`, and the FFT and
IFFT window lengths must match — 512 in both, or the reconstruction is wrong.
