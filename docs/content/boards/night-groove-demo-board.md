# Night Groove

The [Timeline demo](./timeline-demo-board.md)'s night sky with a drum groove
under it. One timeline plays both: it counts in beats, and its placements say
when each drum and each image comes in. Four bars long and looping, with a
tempo knob that speeds up the band and the sky together.

## What it does

Press **Play**. The hi-hats start on the first beat, and a star pops in on each
beat of the first bar. On the second bar the kick comes in, four to the bar,
and a rocket launches with it; a moon appears in the corner and beats with
every kick. On the third bar the snare lands on the backbeat and the planet
arrives. The last two beats are a snare fill, and a comet crosses the sky
while it plays. Then it all starts over.

**Pause** holds the picture and silences the band at once; **Play** carries on
from there. **Stop** goes back to the start. Turning **Tempo** changes how long
a beat lasts, from the next frame on, for the drums and the pictures alike.

## How it works

One [browser runtime](../concepts/runtime.md) with five services:

```
Tempo                      (Hold, writes 120 into the slot "tempo")
Show                       (Timeline, own clock in beats: 16, looping, 60 fps)
Band                       (Tracks, one track per drum; passes the frame on)
├─ hats                    Drum · hihat on 0 and ½ of every beat
├─ kick                    Drum · kick on every beat
├─ snare                   Drum · snare on the second of every two beats
└─ fill                    Drum · six snares over two beats
Scene                      (Tracks, one track per picture, run in order)
├─ sky                     Timeline, reads the Show's time
├─ moon                    Timeline, takes the name "kick"
├─ planet                  Pop
├─ star-1 … star-4         Pop
├─ rocket                  Fly
└─ comet                   Fly
Canvas                     (draws the Scene's answer)
```

The **Show** keeps the clock, sixty times a second. It counts in
[beats](../services/timeline.md#where-time-comes-from), and a beat is as long
as the tempo held in the slot `tempo` says. **Tempo** is a
[Hold](../services/hold.md) that writes 120 there when the board loads, and
the knob writes a new value into it.

Every frame goes to the **Band** first. It is a [Tracks](../services/tracks.md)
service whose tracks only make a sound; its reducer answers with the frame it
was given, so the **Scene** behind it receives the Show's frame, not the Band's
answers. The Scene then draws as the Timeline demo does.

## The Drum block

The drums are written once, as a [block](../concepts/blocks.md) of three
services:

| Service | What it does |
|---|---|
| **Loop** | A timeline driven by the Show, a few beats long and looping, with an [action](../services/timeline.md) at each hit |
| **On a hit** | A [Filter](../services/filter.md) that lets a frame through only when an action fell in it |
| **Sound** | A [Sound](../services/sound.md) in drums mode that plays its drum for every frame it is given |

A use says which drum, how loud, how long its loop is and where the hits lie:

| Use | Drum | Loop | Hits at | Volume |
|---|---|---|---|---|
| `hats` | hihat | 1 beat | 0, 0.5 | 0.35 |
| `kick` | kick | 1 beat | 0 | 0.9 |
| `snare` | snare | 2 beats | 1 | 0.7 |
| `fill` | snare | 2 beats | 0, 0.5, 1, 1.25, 1.5, 1.75 | 0.5 |

Nothing is scheduled. A hit is an action on a timeline, and the timeline works
out from each frame's time which actions it passed. That is why Pause silences
the band: no frame, no hit. It also means a hit sounds with the first frame
after its moment, up to a sixtieth of a second late.

## Placements

The Show's [placements](../services/timeline.md#placements) arrange sound and
picture the same way, by name, in beats:

| Beat | For | Sound | Picture |
|---|---|---|---|
| 0 | 16 | `hats` | |
| 0, 1, 2, 3 | 4 each | | `star-1` … `star-4` |
| 4 | 12 | `kick` | the moon, which takes `kick` too |
| 4 | 8 | | `rocket` |
| 8 | 6 | `snare` | `planet` |
| 12 | 2 | | `star-1`, again |
| 14 | 2 | `fill` | `comet` |

A drum's loop **repeats** for as long as its placement lasts: the kick's one-beat
loop plays twelve times. A picture that does not loop is **stretched** to its
placement, as in the Timeline demo: Pop is three beats of its own, played over
four.

The moon shows that a name can be taken twice. The Show places `kick` once;
the kick's drum and the moon's timeline both take it. The moon loops one beat,
its radius jumping to 10 % on the beat and easing back to 7 %, so it is on
screen exactly while the kick plays and swells on every kick.

## Try it

Open the Show's timeline and drag the `snare` placement to start on beat 4:
the backbeat and the planet still arrive separately, because the planet has
its own placement. Set the moon's `placement` to `snare` and it rises with the
snare instead, on the third bar. Turn the tempo right down and watch the
stars pop in slow motion, one per beat.
