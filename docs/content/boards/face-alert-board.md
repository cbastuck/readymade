# Face Alert

Watches the camera and sends a push notification when a face appears. Seven
services and a block, none of which knows what the others are for.

## What it does

Twice a second it looks at the camera. When a face comes into view — not while
it stays there — it posts a message to an [ntfy](https://ntfy.sh) topic, which
arrives on your phone. The image never leaves the device; only the message
does.

## How it works

One [browser runtime](../concepts/runtime.md).

1. A [Timer](../services/timer.md) ticks every 500 ms.
2. [Camera](../services/camera.md) captures a frame on each tick.
3. [Detect](../services/detect.md) finds the faces in it with a model shipped
   with the app, and reports on **every** frame — `count: 0` included.
4. [Changes](../services/changes.md) watches `params.count > 0` and lets a frame
   through only when that **becomes true**. This is the step that turns "a face
   is there" (every frame) into "a face appeared" (once).
5. [Debounce](../services/debounce.md) holds a 30-second cooldown, so a face
   that the detector loses and finds again for a moment does not notify twice.
6. [Map](../services/map.md) writes the message.
7. The **ntfy notification** [block](../concepts/blocks.md) sends it — the one
   the build ships in its [preset library](../concepts/presets.md), copied into
   this board so it opens anywhere. Its topic, title, priority and tags are the
   block's params, set on its bar.

Steps 3 to 5 are the design, and each is a different question: *what is there*,
*is that new*, *is it too soon*. None of them is specific to faces — the same
chain turns any repeated report into an alert.

## The facade

What the board sees — the camera's frame with each face it found outlined, the
`detect` widget — and how many faces are in view. The camera widget is there
too, drawing nothing (`"preview": false`): it is what captures the frames, and
the picture worth showing is the one after Detect.

## Try it

Pick a topic of your own — anyone who knows a topic on ntfy.sh can read it —
and set it as `topic` on the ntfy block's bar in the board view. Subscribe to it
in the ntfy app, open the board, allow the camera, and look into it.
