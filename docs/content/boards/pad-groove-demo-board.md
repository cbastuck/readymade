# Pad Groove

A four-chord song with no picture: a soft pad, a bass line and the drums from
[Night Groove](./night-groove-demo-board.md), arranged on one
[timeline](../services/timeline.md) that counts in beats. Eight bars long and
looping, with a tempo knob.

## What it does

Press **Play**. For two bars the pad plays alone: A minor 7, F major 7,
C major and G major, a chord a bar, each swelling in and fading into the
next. The hi-hats join on the third bar. On the fifth the bass and the kick
come in together, and on the seventh the snare lands on the backbeat. The last
two beats are a snare fill, and the song starts over with the pad.

**Pause** stops anything new from playing and **Play** carries on from there;
**Stop** goes back to the start. A chord already sounding plays out its bar and
its release either way. **Tempo** changes how long a beat lasts, from the next
frame on, and the chords are held for their bar at the new tempo.

## How it works

One [browser runtime](../concepts/runtime.md) with three services:

```
Tempo                      (Hold, writes 96 into the slot "tempo")
Song                       (Timeline, own clock in beats: 32, looping, 60 fps)
Band                       (Tracks, one track per part)
├─ pad                     Notes · soft wave, a chord a bar
├─ bass                    Notes · triangle wave, four notes a bar
├─ hats                    Drum  · hihat on 0 and ½ of every beat
├─ kick                    Drum  · kick on 0 and 2½ of every bar
├─ snare                   Drum  · snare on the second of every two beats
└─ fill                    Drum  · six snares over two beats
```

The **Song** keeps the clock and counts in beats of the tempo held in the slot
`tempo`. Every frame carries that tempo along with the time, and the **Band**
gives each frame to every part. A part that is not placed answers null at once
and plays nothing.

## Two blocks

Every part is a use of one of two [blocks](../concepts/blocks.md). **Drum** is
Night Groove's: a loop of hits and a [Sound](../services/sound.md) that plays
one drum. **Notes** is its melodic counterpart:

| Service | What it does |
|---|---|
| **Loop** | A timeline driven by the Song, a few beats long and looping, with an action for every note: `{ "at": 4, "data": { "note": "F3" } }` |
| **On a note** | A [Filter](../services/filter.md) that lets a frame through only when a note fell in it |
| **Notes and tempo** | A [Map](../services/map.md) that keeps the notes due and the frame's tempo: `{ "notes": [...], "tempo": 96 }` |
| **Synth** | A Sound in synth mode that plays every note it is given at once |

A chord is several actions at the same moment: a timeline fires every action
due in a frame, in list order, so the four notes of a chord reach the synth
together.

| Use | Wave | Loop | Attack | Held for | Release | Volume |
|---|---|---|---|---|---|---|
| `pad` | soft | 16 beats | 0.8 s | 4 beats | 1.6 s | 0.09 per note |
| `bass` | triangle | 16 beats | 0.01 s | 0.4 beats | 0.12 s | 0.45 |

Note lengths are in **beats**, which is why the tempo travels in the frame.
A service inside a [Tracks](../services/tracks.md) track sees only the slots
of its track, not the `tempo` slot the Song reads. So the Song puts the tempo
it counted at on every frame, the Map hands it to the synth with the notes,
and the synth holds each note for its beats at that tempo. The pad's release
starts after its bar, so each chord fades out while the next one swells in.

## Placements

| Beat | For | Part |
|---|---|---|
| 0 | 32 | `pad` |
| 8 | 24 | `hats` |
| 16 | 16 | `bass`, `kick` |
| 24 | 6 | `snare` |
| 30 | 2 | `fill` |

A looping part **repeats** for as long as its placement lasts, from the moment
it is placed. The pad and the bass each loop four bars. The bass comes in on
beat 16, where the pad's loop starts over, so the first note of the bass is
under the first chord of the pad. Placed on beat 8 instead, the bass would
play A under the C major chord.

## Try it

Open the pad's use and give it a `wave` of `organ`, or a `release` of 3 for a
wash of overlapping chords. Drag the `bass` placement in the Song's timeline to
beat 8 and hear it come in on the wrong chord, then to beat 0, where both loops
start together again. Turn the tempo down to 60: the chords stretch with the
bars.
