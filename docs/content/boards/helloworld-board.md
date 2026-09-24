# Hello World

The smallest board that does something visible: a timer ticks once a second, a
template turns the tick count into a line of text, and a canvas draws it. Three
services, one runtime, no configuration — the shape of every other board on
this page, with nothing else in the way.

## What it does

It prints `HELLO WORLD #1`, then `HELLO WORLD #2`, and keeps counting. That is
all it does, and the point is how little had to be said to make it happen.

## How it works

Everything runs in the [browser runtime](../concepts/runtime.md) — the page
itself, in the same process as the interface. Nothing here needs a server, so
nothing here has one.

The order of the three services is the wiring; there are no connections to
draw.

1. [Timer](../services/timer.md) emits every second. Nothing feeds it — it is
   one of the services that produce output on their own, which is what gives a
   board a heartbeat rather than waiting to be poked.
2. [Map](../services/map.md) receives the tick and reshapes it into a canvas
   drawing instruction. Its template is a single `text` element whose content is
   the expression `"Hello World #" + params.triggerCount`, so the count comes
   from the tick that triggered it rather than from state anybody has to keep.
3. [Canvas](../services/canvas.md) receives that instruction and draws it,
   clearing between frames.

Read it as a sentence: *every second, build a line of text, draw it.* That
sentence is the board.

## Where to go next

[Animate](./animate-board.md) is this board with a moving picture and a GIF
recorder on the end. [Game of Life](./game-of-life-board.md) keeps the same
timer-and-canvas spine but splits the output into two branches that run from
one tick.
