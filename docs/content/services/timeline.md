# Timeline

Time as a value: an object animated through keyframes, and actions fired when
time reaches them.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/timeline` |

---

## What it does

A Timeline animates **one object** (typically an image, given as a Canvas
drawing instruction) through **keyframes** for its properties: where it is, how
big, how far turned, how opaque. It emits the object as it is at each moment.
It also carries **actions**: data placed at a moment and emitted when time
reaches it.

Nothing is scheduled per action. A timeline takes a time `t` and works out
what lies between the time it last saw and the time it sees now. That is what
lets it be paused, sought and looped, and the same time always gives the same
output.

Timelines nest. An outer timeline keeps the clock and drives the inner ones by
passing time down the pipeline. The outer one also says, by name, when each
inner one plays (see *Placements*). Several animated pieces are mixed with
[Tracks](./tracks.md), one track per piece, onto one [Canvas](./canvas.md).

---

## Where time comes from

`clock` decides it:

| `clock` | Time comes from | Used for |
|---|---|---|
| `"own"` (default) | Its own clock, emitting `fps` frames a second while it plays. Input is ignored. | The outermost timeline, the one the facade starts and stops |
| `"input"` | The frames it is given: `t` from the input (or a bare number), in whatever unit the driver counts | Every inner timeline |

An own clock counts in seconds or in **beats** (`unit`). Beats read the tempo
held in the slot `tempoSlot` names, as [Timer](./timer.md#beats) does. The
tempo is read every frame, so a change applies from the next frame. With no
tempo held, a beat is counted at 120 BPM.

### Length and looping

`length` 0 is unbounded. A looping timeline wraps at `length`, and its
positions are `[0, length)`: an action at `length` never fires. A non-looping
one's positions are `[0, length]`.

- An own clock that does not loop halts at its end. Playing again starts over.
- A driven timeline that does not loop emits **null** past its end, so the
  pipeline behind it does not run. The one exception is the frame that leaves
  the stretch: if an action or the end of a placement fell due on the way out,
  that frame is emitted at the edge (`t` = `length`).

### A jump is not a wrap

A driven timeline sees time go backwards both when its driver loops and when
its driver is sought backwards. The two need opposite answers:

- The frame after a seek carries **`jump: true`**. Time was set, not
  travelled, so only what sits exactly there fires.
- Time going backwards **without** `jump` means the driver started over (a
  loop, or a stop and play). The driven timeline settles what it still owed
  from the pass it was in, then starts its own from the beginning.

A timeline passes `jump` on, so a seek is a seek at every level.

---

## The object and its keyframes

`object` is any JSON object, usually a drawing instruction.
`keyframes` maps each animated property to the moments it passes through:

```json
"object": { "type": "image", "url": "…", "height": "20%" },
"keyframes": {
  "rotate":  [ { "at": 0, "value": 0, "ease": "in-out" }, { "at": 3, "value": 360 } ],
  "centerX": [ { "at": 0, "value": "10%" }, { "at": 3, "value": "90%" } ]
}
```

- Before its first keyframe a property holds that keyframe's value; after its
  last, the last one's.
- In between it travels from the keyframe before `t` to the one after, eased
  by the earlier keyframe's `ease`: `linear` (default), `in`, `out`, `in-out`
  (cubic), or `step` (hold until the next).
- Numbers interpolate, as do strings that are a number with the same suffix at
  both ends (`"30%"` to `"70%"`) and `#rrggbb` colours. Anything else holds.
- Two keyframes at the same moment make the value jump there.

---

## Actions

Actions are `{ "at": <number>, "data": <anything> }`. An action is due in a
frame when its time lies in `(previous t, t]`. It is also due when it sits
exactly where time was set: playing from the start, or a seek. Several actions
at one moment all fire, in list order. A frame can cover several passes of a
loop and fires the actions of each. An action without data is reported as null.

Because actions fire only when time passes over them, a seek skips them. For
state that must be right wherever time lands ("from here on, scene B"), use a
keyframe with `step` ease instead.

---

## Placements

Placements arrange driven timelines on the one driving them, **by name**. The
outer timeline's `placements` say when each name plays and for how long. An
inner timeline's `placement` says which name it takes. Neither knows where the
other sits: the name is all they share, as two [Holds](./hold.md) share a slot.

```json
// outer
"placements": [
  { "name": "star-1", "at": 0,   "duration": 3 },
  { "name": "rocket", "at": 2.5, "duration": 4 },
  { "name": "star-1", "at": 6,   "duration": 1.5 }
]

// inner, e.g. inside a block whose param names it
{ "clock": "input", "placement": "{{param.name}}" }
```

Each frame the outer timeline emits carries `placements`: for **every** name it
places, `{ "progress", "elapsed" }` while that name plays (`progress` 0 to 1
through the placement, `elapsed` the outer time since it started), and `null`
while it does not.

| Rule | Behaviour |
|---|---|
| Stretching | A non-looping inner timeline with a length is **stretched** to its placement: its time is `progress × length`. A looping or unbounded one plays at its own speed (`elapsed`) and, if it loops, repeats for as long as the placement lasts. |
| The end | A placement that ends between two frames is reported once more, at its end (`progress` 1), so its final pose and any action at its end are not skipped. |
| Not playing | While its name is not playing, a placed timeline emits null. |
| Entering | A name that starts playing without a jump enters from its start: what sits at 0 fires. |
| The same name twice | Allowed. Where two placements of a name overlap, the one that started later wins. |
| Scoping | A timeline's frames carry **its own** placements only, replacing its driver's, so each level sees the names of the one directly driving it. |
| Looping outer timeline | Placements lie within `[0, length)`; one running past the end is cut there. |
| Not placed | A driven timeline without `placement` reads `t` from its input. |

A mistyped name is a contract nothing checks, so a placed timeline reports its
`placementStatus`:

| Status | Meaning |
|---|---|
| `playing` | Its name is playing now |
| `waiting` | Its name is placed, but not at this time |
| `unplaced` | Frames place other names, never this one: most likely a name mistyped on one side |
| `no-placements` | Frames place nothing at all |

Its panel warns on `unplaced` and `no-placements`.

Everything between two timelines must pass `placements` on. Tracks,
sub-services and Switch do. A [Map](./map.md) in replace mode drops it, as it
drops `t`.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `clock` | `"own" \| "input"` | `"own"` | Where time comes from |
| `object` | `object \| null` | `null` | What the timeline animates |
| `keyframes` | `{ [property]: { at, value, ease? }[] }` | `{}` | Keyframes per property of the object |
| `actions` | `{ at, data }[]` | `[]` | Data emitted when time reaches `at` |
| `length` | `number` | `0` | Length in the timeline's unit; `0` is unbounded |
| `loop` | `boolean` | `false` | Wrap at `length` |
| `unit` | `"s" \| "beats"` | `"s"` | How an own clock counts |
| `tempoSlot` | `string` | `"tempo"` | Slot holding the tempo (BPM) for `"beats"` |
| `fps` | `number` | `30` | Frames a second an own clock emits |
| `speed` | `number` | `1` | Playback speed of an own clock |
| `running` | `boolean` | `false` | Whether an own clock is playing; `true` plays, `false` pauses |
| `placements` | `{ name, at, duration }[]` | `[]` | When each name plays on this timeline |
| `placement` | `string` | `""` | The name a driven timeline takes from its driver; `""` takes none |

### Commands

Only an own clock responds to these.

| Command | Effect |
|---|---|
| `play: true` | Plays from where it is (from the start if it played through to its end), emitting a frame at once |
| `pause: true` | Pauses where it is |
| `stop: true` | Pauses and goes back to 0 |
| `seek: <number>` | Sets the time. Paused, a frame is emitted at once, so scrubbing a paused timeline scrubs everything it drives. The next frame carries `jump: true`. |

Changing `object`, `keyframes` or `placements` re-emits the current frame
without firing anything, so an edit shows while paused. While bypassed, an own
clock keeps time but emits nothing.

---

## Input and output

A driven timeline takes a frame `{ "t": <number>, "placements"?: {…}, "jump"?: true }`
or a bare number. An own clock ignores its input.

It emits **every frame**, not only those an action falls in, because what
follows has to redraw:

```json
{ "type": "image", "url": "…", "height": "20%", "rotate": 180, "centerX": "50%",
  "t": 1.5, "actions": [], "placements": { "star-1": { "progress": 0.5, "elapsed": 1.5 } } }
```

- With an `object`: the object with each keyframed property at its value, plus
  `t` and `actions`. It does not take on its driver's fields, except `jump`. A
  timeline animating a drawing instruction therefore emits a drawing
  instruction, and a Canvas draws it directly, ignoring the other fields.
- Without one: a driven timeline keeps its input's other fields and overwrites
  `t` and `actions`, so a frame can carry more than time down through nested
  timelines.
- `placements` appears when the timeline places names, or when its input
  carried `placements`, and holds this timeline's own.
- `null` where a driven timeline is outside its stretch or its placement is
  not playing.

---

## The panel

Compact, the panel shows the transport, a preview drawn with the Canvas
service's drawing code, the ruler, one lane with every keyframe and action, and
the placements beneath. Expanded, it grows to one row per property (value at
the playhead, a ◆ to set or remove a keyframe there), one per placed name (bars
to drag and resize), and one for the actions.

- A property that is not animated has a fixed value on the object. Once it has
  a keyframe, a value typed at the playhead sets a keyframe there.
- The image button in the transport, or dropping an image on the preview, sets
  the object's image, kept as a data URL.
- Scrubbing an own clock seeks it, and so moves the whole board. A driven
  timeline's playhead is its driver's: scrubbing pins it for editing, and
  "live" follows the driver again.
- Inside a [block](../concepts/blocks.md) use the panel is read-only: keyframes
  and actions can be picked and read, but nothing configures the service.

---

## Example

`boards/timeline-demo-board.json` keeps the clock in a
**Show** timeline (eight seconds, looping) that feeds a Tracks scene, one track
per image, onto one Canvas. Two blocks write the motions once (**Pop** and
**Fly**) and each use names the placement it plays under. The Show's
placements say when each plays and for how long.
