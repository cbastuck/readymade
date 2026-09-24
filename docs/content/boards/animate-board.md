# Animate

A hand-drawn parallax scene — sun, clouds, two ranks of trees, a walker — drawn
25 times a second and recordable as a GIF. Every layer is a template, and the
scene is what you get when five of them run from the same tick.

## What it does

It animates a looping landscape on a canvas. Each element moves at its own
speed, which is all parallax is, and a recorder on the end of the chain can
capture the result as an animated GIF without anything else changing.

## How it works

One [browser runtime](../concepts/runtime.md), five services, and the whole
scene comes out of the third one.

1. [Timer](../services/timer.md) ticks every 40 ms — 25 frames a second.
2. [Tracks](../services/tracks.md) is where the drawing happens. It runs five
   named tracks over that one tick, each a single [Map](../services/map.md)
   producing the draw commands for one layer: `☀️`, `☁️`, `🌳`, `🌲`, `🚶‍♀️`. The
   tracks are named with the emoji of the thing they draw, which reads better in
   the overview than `layer-3` would. Running `serial` means their outputs are
   reduced in order, so the list of shapes comes back stacked back-to-front.
3. [Monitor](../services/monitor.md) shows the combined frame as data, which is
   how you debug a drawing that has gone wrong.
4. [Canvas](../services/canvas.md) draws it, clearing between frames and
   capturing each one because `capture` is on.
5. [GIF Recorder](../services/gif-encoder.md) collects captured frames while
   `recording` is set, up to 300 of them, and writes `animation.gif`.

The interesting part is step 2. Nothing wires the sun to the clouds; five
independent templates each answer the same tick, and *fan-out then reduce* is
the only structure needed to compose a picture out of layers. Adding a sixth
layer is adding a sixth track.

## Try it

Open it and it runs. To record, set the GIF Recorder's `recording` to true,
let it collect frames, then turn it off to get the file.
