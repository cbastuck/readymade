# ASCII Cam

The camera, three times a second, rendered as text. A short chain that turns a
live video frame into a grid of characters and shows it — with a facade so it
can be used without seeing any of that.

## What it does

It shows what your webcam sees, drawn in ASCII, with knobs for the character
grid and a switch to invert it.

## How it works

One [browser runtime](../concepts/runtime.md) — the camera and the display are
both in the page, so nothing leaves it. No frame is uploaded anywhere.

1. [Timer](../services/timer.md) ticks every 300 ms and fires immediately. This
   is the frame rate: the camera is sampled on demand rather than streaming.
2. [Camera](../services/camera.md) captures one frame per tick.
3. [ASCII Art](../services/ascii-art.md) reduces the frame to a 100 × 60 grid of
   characters, optionally inverted.
4. [Monitor](../services/monitor.md) displays it in `ascii` mode at 550 × 500.

Monitor is doing display duty here rather than debugging duty — in `ascii` mode
it is the screen, which is why the board needs no canvas.

## The facade

One panel, `ASCII Cam`, holds the camera view, two knobs for the grid
dimensions, four buttons and a line of text. The knobs write straight into the
ASCII Art service's `cols` and `rows`, so turning one re-renders at a different
resolution. That is the whole point of a [facade](../concepts/board.md#the-facade):
the person using it adjusts a knob, not a service's state.

## Try it

It needs camera permission, and the browser will ask. Everything runs locally.
