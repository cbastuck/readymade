# Timeline Demo

A night sky in which stars pop up, a planet appears and a rocket and a comet
fly across, eight seconds long and looping. It has no animation code: every
image is animated by keyframes on a [timeline](../services/timeline.md) of its
own, and one outer timeline arranges them all.

## What it does

The show starts when the board loads. **Pause** holds it, **Play** carries on,
and **Stop** takes it back to the start. Each star appears with an overshoot,
turns a full circle and fades; the planet does the same, large in the middle
of the sky; the rocket climbs from the bottom left to the top right and the comet
crosses the other way, a small star moving fast. The sky behind them shifts from night to dusk and back
over the eight seconds.

## How it works

One [browser runtime](../concepts/runtime.md) with three services:

```
Show                       (Timeline, own clock: 8 s, looping, 30 fps)
Scene                      (Tracks, one track per image, run in order)
├─ sky                     Timeline, reads the Show's time
├─ planet                  Pop  · name "planet"
├─ star-1                  Pop  · name "star-1"
├─ star-2                  Pop  · name "star-2"
├─ star-3                  Pop  · name "star-3"
├─ star-4                  Pop  · name "star-4"
├─ rocket                  Fly  · name "rocket"
└─ comet                   Fly  · name "comet"
Canvas                     (draws the Scene's answer)
```

The **Show** keeps the clock. Thirty times a second it emits a frame: the time,
and which of the names it places are playing and how far into their placement
they are. The frame carries no picture; it only says when.

The **Scene** is a [Tracks](../services/tracks.md) service, so every track is
given the same frame. Each track answers with the drawing instruction for its
image as it is at that moment, or with null while its image is not playing.
Tracks collects the answers into a list in declaration order, which makes the
first track the one at the back: the sky is drawn first, the comet last.

The [Canvas](../services/canvas.md) clears on every frame and draws the list,
skipping the holes. An image that is not playing is not drawn.

## Two blocks

The motions are written once, as [blocks](../concepts/blocks.md). Each block is
one timeline holding one image and the keyframes that move it:

| Block | Its own length | What it does |
|---|---|---|
| **Pop** | 3 s | Grows from nothing to 125 % in half a second and settles at full size; turns a full circle over the three seconds; stays opaque until 2.2 s, then fades out |
| **Fly** | 4 s | Travels from one point to another, easing in and out; starts tilted 40° and levels off; grows on the way up and shrinks a little as it arrives |

Every use says only what differs:

| Parameter | Pop | Fly |
|---|---|---|
| `image` | a star by default; the planet's use gives a ringed planet | a rocket by default; the comet's use gives a small star |
| where | `x`, `y` (the centre) | `fromX`, `fromY`, `toX`, `toY` |
| `size` | height, as a share of the canvas | height, as a share of the canvas |
| `name` | the name it plays under | the name it plays under |

A use does not say *when* it plays. That is the Show's business.

## Placements

The Show's [placements](../services/timeline.md#placements) put a name at a
moment for a while. The timeline inside each use takes the name its `name`
parameter gives it, and plays while that name is placed:

| Name | At | For | Its own length | So it plays |
|---|---|---|---|---|
| `star-1` | 0 s | 3 s | 3 s | as written |
| `star-2` | 0.7 s | 3 s | 3 s | as written |
| `star-3` | 1.4 s | 3 s | 3 s | as written |
| `star-4` | 2.1 s | 3 s | 3 s | as written |
| `rocket` | 2.5 s | 4 s | 4 s | as written |
| `planet` | 4.5 s | 3 s | 3 s | as written |
| `star-1` | 5 s | 2 s | 3 s | 1.5 times as fast |
| `comet` | 5.5 s | 2.5 s | 4 s | squeezed into 2.5 s |

A timeline that does not loop is **stretched** to fit its placement, so the
same motion can be placed at any length. The second `star-1` is the first one
played again, faster; the comet is the rocket's flight, done in less time.

Neither side knows where the other sits. The Show names `rocket` without
knowing it is inside a track, inside a block; the rocket's timeline takes
`rocket` without knowing what places it. That is what lets a use be moved to
another track, or the whole Scene be rearranged, without touching the Show.

Every track is still given every frame. A timeline whose name is not playing
answers null at once, so the rest of its track does not run. In the overview,
the timelines that are playing glow; the ones that are waiting show only a
faint tint.

## The sky

The sky is a timeline too, but placed nowhere: it has no `name` to take, so it
reads the Show's time directly. Its object is a rectangle the size of the
canvas, and one keyframed property, its colour: `#0b1026` at 0 s, `#312e81`
at 4.5 s, back to `#0b1026` at 8 s. Because the Show loops at 8 s, so does the
sky.

## Try it

Pause the show and drag the Show's playhead: the whole board follows, and the
canvas shows every image as it is at that moment. Open the Show's timeline,
drag the comet's placement to start earlier, or stretch its bar to slow it
down. Set `star-3`'s `name` parameter to `star-1` and it pops with the first
star, twice a loop. Give it a name the Show does not place and it never
appears, and its panel warns that its name is never placed.
