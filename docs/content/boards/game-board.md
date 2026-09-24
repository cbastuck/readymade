# Breakout Game

A playable Breakout, split across four runtimes, with a phone as the paddle
controller. The most elaborate browser-only board here, and the best example of
services reaching sideways rather than only forwards.

## What it does

A ball, a bar, and bricks on a canvas at 50 frames a second. You control the bar
with an on-screen XY pad — or by scanning a QR code and using your phone.

## How it works

Four [browser runtimes](../concepts/runtime.md). Three of them are the game; the
fourth exists to hand a controller to a second device.

### Input

1. [Peer Socket](../services/peer-socket.md) in *Receive only*, registered as
   `breakout-host`, listening for `breakout-phone`.
2. [XY Pad](../services/xy-pad.md) — the on-screen control, for playing without
   a phone.
3. **Map Input**, a [Map](../services/map.md), normalises whichever arrived.
4. **Send to Cache**, a [Configurator](../services/configurator.md), writes the
   position into the `game` runtime's cache. It does **not** pass through: the
   input chain ends here, having deposited a value somewhere else.

### Game

1. [Timer](../services/timer.md) at 20 ms — the game loop.
2. **State Cache**, a [Cache](../services/cache.md), holds the world between
   frames. A pipeline is stateless, so the state has to live in a service, and
   this is it.
3. **Game Logic**, a [Map](../services/map.md), advances the world one step.
4. **Cache Game State**, a [Configurator](../services/configurator.md), writes
   the new world back — this one *does* pass through, so the frame continues.
5. [Tracks](../services/tracks.md) draws it: one track for the ball, one for
   the bar.

### Canvas

[Canvas](../services/canvas.md) draws the frame and reports its size. **Cache
Size** then writes that size back into the game runtime's cache, but only
through a [Filter](../services/filter.md) that stops unless the size actually
changed — otherwise the game state would be rewritten fifty times a second for
nothing.

### Phone Controller

A [Sub-Service](../services/sub-service.md) in `source` mode holds an entire
second board — *Breakout Controller* — containing an
[XY Pad](../services/xy-pad.md) and a [Peer Socket](../services/peer-socket.md)
in *Send only*. That inner board is
[LZ-compressed](../services/lz-compress.md) into a URL, which becomes the QR
code you scan. Open it on a phone and the phone is now the paddle, talking
directly to the host over WebRTC.

## Why it is built this way

Three of the four runtimes write into the same cache using
[Configurator](../services/configurator.md) rather than passing values along a
line. Input arrives on its own schedule, the canvas resizes whenever the window
does, and the game loop runs on a timer — three rates that do not line up, so a
single chain could not carry all three. The cache is the shared state and the
configurator is how a service in one runtime writes to a service in another.

The phone controller is the other idea worth taking away: a board can *contain*
another board and hand it out as a link. Nothing was deployed to make the phone
work.
