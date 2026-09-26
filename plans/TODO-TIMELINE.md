# Timeline

A service with a timeline for a UI. It animates **one object**, typically an
image dropped onto it, through **keyframes** for its properties (where it is,
how big, how far turned, how opaque), and emits the object as it is at each
moment. It also carries **actions**: data placed at a moment and emitted when
time reaches it. Timelines nest: an outer timeline drives the time of the inner
ones. The board built from it is the visual counterpart of
`nested-rhythm-demo-board.json`, where small animated blocks together make one
animation drawn on one canvas.

**State:** decided 2026-09-26; placements built the same day (see *Placements*).
The service (time, actions, object and keyframes) is built in `Timeline.ts`
and `timeline-core.ts`, and so is the demo board, `boards/timeline-demo-board.json`. Tests are in
`tests/timeline-service.test.ts` and `tests/timeline-board.test.ts`. There is
the timeline UI (`TimelineUI/`), tested in `tests/timeline-ui-model.test.ts`
and `tests/timeline-ui.test.tsx` but not yet seen in the app. No docs page yet. Performance and frame rate are judged on
the prototype, not in advance.

---

## Decided

| Question | Decision | Why |
|---|---|---|
| Model of time | **Time as a value.** A timeline takes `t` in and works out what is due at `t`; nothing is scheduled per action | Pause, seek, loop and deterministic rendering (e.g. to a GIF) all follow from it. With timers per action in flight, none of these is possible without cancelling and rebuilding every schedule. |
| What a timeline animates | **One object**, and keyframes for its properties | Arranging several objects is composition (Tracks, blocks), the nesting this started from. A timeline holding many objects would be a small animation editor inside one service. Decided 2026-09-26. |
| How movement is authored | **Keyframes**, interpolated and eased, not expressions over `t` | Motion written as Map arithmetic over `t` is what `animate-board.json` already does. A timeline that only supplies `t` changes nothing about how movement is made. |
| What the UI edits | **The object, its keyframes, and actions**, all placed on one time axis | The events are the authoring surface; time as a value is the implementation. |
| Several actions at one time | **All fire**, in the order they sit in the list | One is only the simple case. |
| Nesting | **An outer timeline drives an inner one** by passing time down the pipeline | The same shape as a Note inside a bar: the inner piece owns its stretch of time and never knows where it sits. |
| Routing | **No targets.** A timeline emits on its own output; Switch, Tracks and Hold decide where it goes | Addressing a service, runtime or block from an action is a wire. |
| Composition of pictures | **Blocks emit drawing instructions, one Canvas draws** | Capturing each block's canvas to an image and redrawing it costs an encode and decode per layer per frame and loses resolution. A Canvas inside a block stays useful as a preview, because it passes its input through. |
| Mixing layers | **Tracks**; declaration order is layer order | Already the fan-out and reduce primitive (`tracks-demo-board.json`). |

---

## The service

Browser runtime first (`timeline`), because the first board is visual and
draws in the browser. Other runtimes follow if an audio or server board needs it.

### Where time comes from

`clock` says which:

- **`"own"`:** the timeline runs its own clock, with `play`, `pause`, `stop`
  (pause and back to 0) and `seek`, and `running` kept like Timer's. This is
  the outermost timeline, the one the facade starts and stops. It emits `fps`
  frames a second. Input is ignored. Time is counted in seconds or **beats**
  (`unit`). Beats read the tempo slot as Timer does (`tempoSlot`, default
  `"tempo"`), measured per frame, so a tempo change applies from the next frame.
- **`"input"` (driven):** the timeline has no clock of its own. This is every
  inner timeline. With a `placement` it plays when and as its driver places
  that name (see *Placements*). Without one it reads `t` from its input (or a
  bare number), in whatever unit its driver counts, so `unit` only matters to
  an own clock.

A driven timeline's time wraps at `length` when it loops. Past the end of a
stretch that does not loop, or while its placement is not playing, it emits
nothing (null), so a block that is not on draws nothing and the pipeline behind
it is not run. The one exception is the frame that leaves the stretch: if an
action fell due on the way out (one at `length`), that frame is emitted at the
edge.

`length` 0 is unbounded. A looping timeline's positions are `[0, length)`, so an
action at `length` never fires. A non-looping one's are `[0, length]`. An own
clock that does not loop halts at its end, and playing again starts over.

### A jump is not a wrap

A driven timeline sees time go backwards both when its driver loops and when it
is sought backwards, and the two need opposite answers. The frame after a seek
carries **`jump: true`**. Without it, time going backwards means the driver
started over (a loop, or a stop and play). The driven timeline then settles
what it still owed from the pass it was in and starts its own from the
beginning. With it, time was set rather than travelled, and only what sits
exactly there fires. A driven timeline passes `jump` on, so a seek is a seek at
every level.

### The object and its keyframes

`object` is what the timeline animates: any JSON object, usually a drawing
instruction (`{ "type": "image", "url": …, "height": "20%" }`). `keyframes`
maps each animated property to the moments it passes through:

```json
"keyframes": {
  "rotate":  [ { "at": 0, "value": 0, "ease": "in-out" }, { "at": 3, "value": 360 } ],
  "centerX": [ { "at": 0, "value": "10%" }, { "at": 3, "value": "90%" } ]
}
```

- A value holds its first keyframe's before it and its last one's after it.
- In between it travels from the keyframe before `t` towards the one after,
  eased by the earlier keyframe's `ease`: `linear` (the default), `in`, `out`,
  `in-out` (cubic) or `step` (hold until the next).
- Numbers interpolate, and so do strings that are a number with the same suffix
  at both ends (`"30%"` to `"70%"`) and `#rrggbb` colours. Anything else holds.
- Two keyframes at the same moment make the value jump there.

### What it emits

Every frame, not only when an action fires, because what follows it has to
redraw: the object with each keyframed property at its value, plus `t` and the
actions due.

```json
{ "type": "image", "url": "…", "rotate": 180, "centerX": "50%",
  "t": 1.5, "actions": [ { "...": "data of each action due this frame" } ] }
```

A timeline animating a drawing instruction therefore emits a drawing
instruction, and the Canvas draws it directly: other fields are ignored.

An action is due in a frame when its time lies in `(previous t, t]`, and at the
position time was set to (play from the start, a seek) as well. A frame can
cover several passes of a loop. A driven timeline **with no object** keeps its
input's other fields, overwriting `t` and `actions`. One with an object does
not take on its driver's fields, except `jump`. While bypassed, an own clock
keeps time but emits nothing.

Actions are `{ "at": <number>, "data": <anything> }`. An action without data
is reported as null.

Spans (actions with a duration and a `progress`) were planned for tweens and
are dropped: keyframes do that job without arithmetic after the timeline.

### The UI

Decided 2026-09-26, built the same day:

| Question | Decision |
|---|---|
| Surface | **Panel + expand.** The panel: transport, a preview, the ruler and one lane with every keyframe and action on it. The expand button opens a wide editor (a dialog) with one lane per property and the actions lane. |
| Setting values | **Fields at the playhead.** A property that is not animated has a fixed value on the object, and its field changes that. Its ◆ button sets a keyframe at the playhead, and from then on a value typed there sets a keyframe there. Pressing ◆ on a keyframe takes it away; taking the last one away leaves its value as the object's. Direct manipulation on the preview (drag to move, handles to turn and scale) is later, on the same preview. |
| Scrubbing | **Moves the whole board.** An own clock sought while paused emits a frame at once (marked `jump`). A driven timeline's playhead is its driver's: scrubbing pins it for editing, and "live" follows the driver again. |
| Showing edits | Editing the object or keyframes re-emits the current frame, so the canvas shows the change while paused. Not before the timeline has emitted anything, since a board configures its services while it loads. |
| Block uses | **Read-only.** A use's inside is locked, and it is edited through the block's definition. The panel takes the lock over from its frame (`usePanelBlockLock`), so inside a use it shows itself read-only: the editor still opens, and a keyframe or action can be picked and read, but nothing configures the service. An inner timeline's playhead can still be pinned, since that writes nothing. |

- Image: dropped on, or picked by pressing, the preview. It is kept as a data
  URL. An image already there only changes its `url`.
- Rows: the object type's suggested properties (for an image: `centerX`,
  `centerY`, `height`, `rotate`, `scale`, `opacity`), then any other keyframed,
  and any other typed in by name.
- Keyframes and actions snap to 0.05. Picking a keyframe offers its ease and
  removal; picking an action offers its data as JSON.
- The preview is drawn with the Canvas service's own drawing code.

---

### Placements

Decided and built 2026-09-26. Replaces `offset` and a driven timeline's
`speed`. The demo board arranges all its images this way.

**The problem.** Where an inner timeline starts was its own `offset`, fed
through a block param. The outer timeline, where the arranging happens, had no
say and no view of it.

**Rejected: the outer editor showing the inner timelines it reaches.** That
works out the board's structure from inside one service's panel. It only
seemed cheap because every runtime in the demo shares one process. On a remote
runtime or a cloud board, a panel has no view of the board, and one timeline's
editor should not need the coordinator to draw itself.

**Rejected: the outer timeline naming inner timelines by address.** That is a
wire: it addresses into block uses, which blocks refuse, and breaks when a track
is renamed, moved or pasted.

**Decided: named placements.** The outer timeline says *when* a name plays; an
inner timeline says *which* name it takes. Neither knows where the other sits,
the way two Holds share a slot.

```json
// outer (the Show)
"placements": [
  { "name": "star-1", "at": 0,   "duration": 3 },
  { "name": "rocket", "at": 2.5, "duration": 4 },
  { "name": "star-1", "at": 6,   "duration": 1.5 }
]

// a frame, carrying each placement active in it
{ "t": 2.8, "actions": [],
  "placements": { "rocket": { "progress": 0.075, "elapsed": 0.3 } } }

// inner (in the Pop block)
{ "clock": "input", "placement": "{{param.name}}" }
```

Everything a placement needs travels in the frame, as JSON, so it crosses a REST
runtime like `t` does. Nothing is wired at run time; the names are in the board.

**Rules**

| Question | Decision | Why |
|---|---|---|
| What the frame carries | For **every** name the timeline places: `{ progress, elapsed }` while it plays (`progress` 0 to 1 through the placement, `elapsed` the outer time since it started), and `null` while it does not | The outer timeline knows the duration and the inner one knows its length; neither knows both, so each side computes with what it has. Listing the names not playing lets a placed timeline tell "not now" from "never": the latter is a name placed on one side only. |
| The end of a placement | A placement that ends between two frames is reported once more, at its end (`progress` 1) | Otherwise the last of it (the final pose, an action at the end) falls between frames. |
| Stretching | A **non-looping** inner timeline with a length is **stretched** to its placement: its time is `progress × length`. A **looping** or **unbounded** one plays at its own speed (`elapsed`), and a looping one repeats for as long as the placement lasts. | Decided by the user: the outer duration scales the inner's intrinsic length. A loop has no whole to fit; one slow twinkle is not what placing Twinkle across the night means. |
| The same name twice | Allowed: the star plays at 0 s and again at 6 s from one use. Where two of a name overlap, the one that started later wins. | One inner timeline has one playhead. |
| Entering a placement | A name absent from the previous frame and present in this one enters from its start: what sits at 0 fires. After a `jump` (a seek), only what sits exactly there fires, as before. | A placement appears in a frame already partway in, so there is no rise through 0 to see. |
| Scoping | A timeline's output **replaces** `placements` with its own, empty when it has none. | Otherwise Twinkle below Night would also see the Show's names. Each level sees only its direct driver's, like slot scopes. |
| Not placed | A driven timeline without `placement` reads `t` from 0, as now. | The simple case keeps working: the Sky reads the Show's time. |
| `offset`, driven `speed` | **Removed.** | Decided by the user; a placement's `at` and `duration` do both. The own clock keeps `speed` for playback. |
| A looping outer timeline | Placements lie within `[0, length)`. One running past the end is cut there. | The loop starts every placement over anyway. |

**What it costs**

- **A name is a contract nothing checks.** A mistyped name silently never
  plays. Built: a placed timeline reports its `placementStatus` (`playing`,
  `waiting`, `unplaced` for frames that place other names but never its own,
  `no-placements`), and its panel warns on the last two. Not built: the
  coordinator warning on load wherever it sees every runtime, as a check rather
  than a requirement.
- **The outer editor knows only names**, not an inner timeline's content or
  length. A placement is a named bar sized by its own duration.
- **Timing leaves the use.** A Pop use no longer says when it plays: copied
  to another board, it plays only where that board places its name. That is the
  arrangement model (the arrangement places clips, a clip does not place
  itself), unlike the rhythm board, where each Note carries its own wait.
- **Everything in between must pass `placements` on.** Tracks, sub-services and
  Switch do. A Map in replace mode drops it, as it already drops `t`.

**The UI** (built). The editor has a placements section: one row per name, its
placements as bars. Drag a bar to move it, drag its right edge to change its
duration, type a name to place it at the playhead, rename a row to rename every
placement of that name; a picked bar shows its name, start and duration. The
panel shows the placements as a thin row of bars. A driven timeline's panel
shows the name it takes and whether it plays, and the editor has its
`placement` field where "starts at" and "speed" were.

## The canvas side

- **A `group` draw type**:
  `{ "type": "group", "x", "y", "scale", "rotate", "opacity", "items": [...] }`,
  drawn with `save` / `translate` / `scale` / `rotate` / `restore`. It is the
  spatial counterpart of the waits. A block draws in its own space, and the
  level above places it.
  Needed when an outer level transforms a whole block (move a group, fade it
  out). Not built. A Tracks reducer with a Map could wrap a block's answer in
  one.
- ~~**Nested arrays**~~: drawn as one, in order (built 2026-09-26).
- ~~**Images turn and scale**~~: `rotate` (degrees) and `scale` about the
  image's own centre (built 2026-09-26). Without `centerY`, an image is now
  centred by the height it is drawn at; it used the image's natural height.

---

## The board

`timeline-demo-board.json`, built 2026-09-26. A **Show** timeline keeps the
clock (eight seconds, looping) and feeds a Tracks **Scene**, one track per
image, onto one Canvas. Two blocks write the motions once:

- **Pop:** appear with an overshoot, turn a full circle, fade.
- **Fly:** travel from one place to another, tilting.

Four stars and a planet are uses of Pop, and a rocket and a comet are uses of
Fly. Each use says which image, where, and the name it plays under; the Show's
placements say when each name plays and for how long. `star-1` is placed twice,
the second time shorter, so the same pop plays faster; the comet's four-second
flight is squeezed into two and a half.
The sky is a timeline too, its colour keyframed. The images are inline SVG data
URLs. The facade is the canvas with Play, Pause and Stop.

Still to show: an outer level transforming a whole block (needs `group`), and
shared slots (a palette, a tempo in beats) making the pieces read as one.

---

## Phases

1. ~~`timeline` service: own and driven time, point actions, loop, beats. Tests
   for due-ness across frames, loop wraps, seek and several actions at one time.~~
   Built 2026-09-26; generic panel until phase 2.
2. ~~Object and keyframes, with easing~~ (built 2026-09-26, replacing spans).
3. ~~Canvas: images turn and scale, nested arrays~~ (built 2026-09-26).
4. ~~The board~~ (built 2026-09-26).
5. ~~Timeline UI~~ (built 2026-09-26; tested, not yet seen in the app).
6. ~~Placements~~ (built 2026-09-26: service, editor section, placed
   timeline's status, demo board moved over).
7. Canvas `group`, and a board where an outer level moves a whole block.
8. Docs page, vocabulary check, and the performance judgement.

---

## Open

- **Seeking and state.** Point actions fire when time passes over them, so a
  seek skips them. An action that means "from here on, scene B" leaves the board
  in the wrong scene after a seek backwards. Either such things are keyframes
  with `step` ease (state derived from `t`, always right), or the timeline
  "chases" by firing the last skipped action of each kind. Keyframes come first.
  Chasing only if a board needs it.
- **Several lanes** in one timeline, or several timelines in Tracks. The latter
  already works and keeps the service small.
- **Stretching a looping timeline.** The rule above plays a loop at its own
  speed. If a board wants a loop stretched instead (a pass per placement), that
  is a per-placement option, not a default.
- **Frame rate and cost:** nested SubServices, Tracks and a Canvas redraw per
  frame. The Canvas only drops frames in capture mode. Judged on the prototype.
