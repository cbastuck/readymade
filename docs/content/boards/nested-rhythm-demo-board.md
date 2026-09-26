# Nested Rhythm

A drum groove with no sequencer, no step grid and no wiring: every hit is timed
by where it sits in a nest of sub-services. Four patterns to choose from, each
built from the same kind of blocks. The tempo and the pattern are set in one
place, and every level of the nest reads them from there.

## What it does

Press **Play** and it loops a one-bar groove until you press **Stop**. Pick a
pattern and it takes over at the next bar line. Turn **Tempo** and the whole
groove follows. The playground shows the playhead: each
service lights up while it runs, and a waiting Timer stays lit for as long as
it waits, so you can watch the bar move down through the levels.

## How it works

One [browser runtime](../concepts/runtime.md) holding one
[scope](../concepts/scopes.md), the **Groove**. Every bar starts with the clock
ticking; **Which pattern** reads the chosen pattern's name out of a slot, and a
[Switch](../services/switch.md) routes the bar into the pattern of that name.
Each pattern is a bar of [Browser Sub-Services](../services/browser-sub-service.md)
nested inside each other, with [Sound](../services/sound.md) instances playing
a fixed drum on whatever reaches them:

```
Groove                     (scope: own slots)
├─ Tempo                   (Hold → slot "tempo", 120)
├─ Pattern                 (Hold → slot "pattern", "straight")
├─ One bar                 (Timer, every 4 beats)
├─ Which pattern           (Hold ← slot "pattern")
└─ Patterns                (Switch)
   ├─ Straight             (inherits slots)
   │  ├─ Kick
   │  ├─ Two beats
   │  │  ├─ Beat
   │  │  │  ├─ Hi-hat
   │  │  │  ├─ Wait an eighth   (Timer, ½ beat)
   │  │  │  ├─ Hi-hat
   │  │  │  └─ Wait an eighth   (Timer, ½ beat)
   │  │  ├─ Snare
   │  │  └─ Beat
   │  └─ Two beats
   ├─ Shuffle
   ├─ Four on the floor
   └─ Funk
```

A Timer that is not periodic holds whatever it is given for its delay, then
passes it on. A sub-service answers once its pipeline has, so **a
sub-service lasts as long as the waits inside it**: a Beat is two eighths
long, Two beats is two Beats long, and the Bar is two of those. Services with
no wait between them play together, so the kick and the first hi-hat land on
the same instant, and the snare lands with the first hi-hat of the second Beat.

## The patterns

Every pattern is a bar made the same way, from blocks that each know one
thing. What makes them different is which blocks they are made of:

| Pattern | Kick | Snare | Hi-hat | What changed |
|---|---|---|---|---|
| **Straight** | 1 | 2, 4 | every eighth | the bar above |
| **Shuffle** | 1, 3 | 2, 4 | every eighth, swung | the Beat waits ⅔ of a beat, then ⅓, instead of ½ and ½; a second Kick sits between the two Two beats |
| **Four on the floor** | every beat | 2, 4 | the off-beats | the Beat is a kick, then a hi-hat half a beat later |
| **Funk** | 1, the "and" of 2, the "and" of 3 | 2, 4 | every sixteenth | the Beat is four sixteenths; a second block, *Kick on the and*, puts a kick halfway through them |

The Shuffle is the clearest case of what nesting buys: it is the Straight bar
with one block swapped. Changing the two waits inside the Beat swings every
hi-hat in the bar, because every beat of the bar is that block.

The Funk's two halves reuse *Kick on the and* in different places: the first
half is Kick, Sixteenths, Snare, *Kick on the and*; the second is *Kick on the
and*, Snare, Sixteenths. That puts the pushed kicks either side of the middle
of the bar.

A pattern is chosen once per bar, when Which pattern reads the slot, so a new
choice never cuts into the bar that is playing.

## Where the tempo lives

No Timer on the board knows how long anything takes. Each one waits a number
of [**beats**](../services/timer.md#beats), and looks the tempo up in a
[slot](../services/hold.md#where-its-cells-live) called `tempo` each time it
waits.

The slot belongs to the Groove, which keeps its cells to itself
(`scope: { slots: "own" }`); the **Tempo** Hold writes the board's tempo into
it. Every scope inside says `scope: { slots: "inherit" }`, meaning *my cells
are the ones of whatever holds me*. So a Beat asks Two beats, which asks the
pattern's bar, which asks the Groove. The Switch between them is not a scope
and passes the question straight through: a case is a branch of the pipeline
around it. The Beat is written without knowing where the tempo is set, or that
it is set at all.

That default matters: a scope keeps its cells to itself unless it says
otherwise, so a reusable block cannot pick up a slot by accident. Here each
level opts in, and the board says so.

The Tempo knob configures the Hold, which writes the slot. The next wait
anywhere in the nest reads the new tempo, and the clock applies it from the
bar after the one already scheduled. The pattern buttons do the same with the
Pattern Hold. The board saves the tempo and pattern last set, so the groove
comes back as it was left.

## Why nesting

The rhythm is written once per level rather than once per step. The Beat
knows nothing about snares or bars; Two beats knows nothing about hi-hats. Add
a third hi-hat to a Beat (and make its waits a third of a beat) and every
beat of the bar becomes a triplet. Move the snare before the first Beat in Two
beats and the backbeat becomes an on-beat. The board has the same structure a
score has: bars made of beats made of subdivisions.

## Timing

The clock starts every bar, so the drums never drift apart over time. Within
a bar each wait runs a couple of milliseconds late in the browser, and those
add up to around 20 ms by the last eighth before the next tick starts the bar
fresh. Turning the tempo mid-bar gives one uneven bar: the waits still ahead
play at the new tempo, but the next tick was already scheduled at the old one.

**Stop** does two things: it stops the clock, and it
[cancels](../services/browser-sub-service.md#commands) the Groove. Cancelling
ends the bar already playing where it is, so the groove stops at once rather
than at the end of the bar.

A drum is heard after the latency of the audio output, which the Sound panels
show. On wired speakers it is a few milliseconds; a Bluetooth device can add a
couple of hundred, and then the playhead in the playground runs visibly ahead
of what you hear.

## Try it

Press **Play**, then switch between the patterns and turn **Tempo**. Open the
Shuffle's Swung beat in the playground and change its two waits, ⅗ and ⅖ for
a lighter swing, or ¾ and ¼ for a dotted feel. Or delete the Snare from one
Two beats and hear the backbeat thin out to beat 4 only.
