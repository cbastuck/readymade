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
Each pattern is a [Browser Sub-Service](../services/browser-sub-service.md)
holding four more, one per beat, and each beat holds the **Notes** that fall
in it:

```
Groove                     (scope: own slots)
├─ Tempo                   (Hold → slot "tempo", 120)
├─ Pattern                 (Hold → slot "pattern", "straight")
├─ One bar                 (Timer, every 4 beats)
├─ Which pattern           (Hold ← slot "pattern")
└─ Patterns                (Switch)
   ├─ Straight             (inherits slots)
   │  ├─ Beat 1             (inherits slots)
   │  │  ├─ Kick            Note: 0 · kick · 0
   │  │  ├─ Hi-hat          Note: 0 · hi-hat · ½
   │  │  │  ├─ Wait before  (Timer, 0 beats)
   │  │  │  ├─ Sound        (Sound: hi-hat)
   │  │  │  └─ Wait after   (Timer, ½ beat)
   │  │  └─ Hi-hat          Note: 0 · quieter hi-hat · ½
   │  ├─ Beat 2
   │  │  ├─ Snare           Note: 0 · snare · 0
   │  │  └─ …
   │  ├─ Beat 3
   │  └─ Beat 4
   ├─ Shuffle
   ├─ Four on the floor
   └─ Funk
```

The Note is the board's one [block](../concepts/blocks.md): defined once, used
for every drum hit, with four parameters given at each use —

| Parameter | What it is |
|---|---|
| `waitBefore` | beats to wait before the sound |
| `sound` | which drum: `kick`, `snare`, `hihat` |
| `waitAfter` | beats to wait after it |
| `volume` | 0 to 1 |

A Timer that is not periodic holds whatever it is given for its delay, then
passes it on, and one of zero passes it on at once. A sub-service answers once
its pipeline has, so **a Note lasts as long as its two waits**, a beat as
long as its Notes, and a bar as long as its four beats. A Note with nothing after it sounds together with the next
one: the kick and the first hi-hat land on the same instant because the kick
waits for nothing.

Each Note carries its own stretch of time, so it can be read, moved or changed
without working out what its neighbours do. That is the reason for two waits
where one would do: a wait before the sound could always be written as a wait
after the note before it, but then shaping one note would mean editing
another.

## The patterns

Every pattern is four beats of Notes. What makes them different is only which
drums are in them and how their waits are split:

| Pattern | Kick | Snare | Hi-hat |
|---|---|---|---|
| **Straight** | 1 | 2, 4 | every eighth |
| **Shuffle** | 1, 3 | 2, 4 | every eighth, swung |
| **Four on the floor** | every beat | 2, 4 | the off-beats |
| **Funk** | 1, the "and" of 2, the "and" of 3 | 2, 4 | every sixteenth |

Straight and Shuffle show what the wait before is for. A straight hi-hat is
`0 · hi-hat · ½`: it plays, then takes half a beat. The Shuffle's second
hi-hat of each beat is `⅙ · hi-hat · ⅓`: it still takes half a beat, but plays
a sixth of a beat into it, which lands it two thirds of the way through the
beat. The swing lives in that one note; the Note before it is a plain eighth.

The Funk's pushed kicks are the same idea without a wait: a `0 · kick · 0` Note
just before the third sixteenth of a beat sounds with that hi-hat, on the
"and".

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
are the ones of whatever holds me*. So a Note asks its beat, which asks the
pattern's bar, which asks the Groove. The Switch between them is not a scope
and passes the question straight through: a case is a branch of the pipeline
around it. The Note is written without knowing where the tempo is set, or that
it is set at all.

That default matters: a scope keeps its cells to itself unless it says
otherwise, so a reusable block cannot pick up a slot by accident. Here each
level opts in, and the board says so.

The Tempo knob configures the Hold, which writes the slot. The next wait
anywhere in the nest reads the new tempo, and the clock applies it from the
bar after the one already scheduled. The pattern buttons do the same with the
Pattern Hold. The board saves the tempo and pattern last set, so the groove
comes back as it was left.

## Why one block

An earlier version of this board built each pattern from blocks for a beat,
two beats, a swung beat and so on, each defined once and used wherever it
recurred. It wrote less down, but the blocks were whatever happened to repeat
across the four patterns: add a fifth pattern and the best grouping changes.
A musician changing a pattern thinks in notes, not in which repeats a block
happens to capture. One Note block with four parameters fits any pattern, and
a new pattern is four new beats of Notes.

The beats are plain sub-services, not blocks: they are there to give a bar the
shape a musician reads it in, not to be reused. Each one is exactly a beat
long, so a beat can be opened, read and changed on its own, and its Notes'
waits add up to one.

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
Shuffle in the playground and set the `waitBefore` of a swung hi-hat to 0.25
with a `waitAfter` of 0.25 for a harder swing on that one eighth — the others
keep theirs. Or add a Note: a `0 · snare · 0` at volume 0.2, placed just
before the second hi-hat of Straight's Beat 2, sounds with it — a ghost snare on the
"and" of 2, and nothing else in the bar moves.
