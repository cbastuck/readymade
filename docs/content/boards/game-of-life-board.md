# Game of Life

Conway's Game of Life, simulated on an infinite sparse grid, with each
generation sent down two branches at once: one draws it, the other plays it.
The same generation becomes a picture and a chord.

## What it does

It runs the cellular automaton and shows the result twice over — as cells on a
canvas, and as notes from a synthesiser. Watching it and listening to it are
the same data arriving in two forms.

## How it works

Everything is in one [browser runtime](../concepts/runtime.md). The chain is
three services deep, and the third one forks.

1. [Timer](../services/timer.md) ticks at 220 BPM, firing immediately on start
   rather than waiting out the first interval. A beat is the natural unit here
   because the output is partly music.
2. [Game of Life](../services/game-of-life.md) advances one generation per tick
   and emits the live cells. It only simulates — it draws nothing, which is what
   lets the next step send the same generation two ways.
3. [Tracks](../services/tracks.md) runs two named branches over that one
   generation:

   **`visual-branch`** —
   [Game of Life Renderer](../services/game-of-life.md) turns cells into draw
   commands at 8 px a cell, and [Canvas](../services/canvas.md) draws them.

   **`audio-branch`** — [Map](../services/map.md) extracts the objects,
   a second Map enriches them, [Sort](../services/sort.md) orders them by how
   alive they are, [Limit](../services/limit.md) keeps the top six,
   a third Map turns those into notes, and [Sound](../services/sound.md) plays
   them on a sawtooth synth.

The audio branch is worth reading closely: it is a small query. Sort by
liveness, take six, map to pitch. Six is there because a chord of six notes is
about as much as the ear takes, and the loudest cells being the played ones is a
decision expressed as `sort` then `limit` rather than as code.

## Why it is split this way

The simulation and its renderer are separate services on purpose — see
[Game of Life](../services/game-of-life.md). A simulation that drew its own
output could not have been sent to a synthesiser without being changed. Because
it only emits state, the branch that plays it did not have to be anticipated.
