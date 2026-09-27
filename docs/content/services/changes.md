# Changes

Lets the input through only when what it watches has changed since the last input — a stream of reports becomes a stream of events.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/changes` |

---

## What it does

Many sources report a state over and over: a detector says how many faces it
sees on every frame, a poll returns the same status every minute, a sensor
reads the same level for an hour. What a board usually wants to act on is the
moment that state **changes** — a face appeared, the status went red.

Changes remembers what it watched last time. Each input is compared with it:

- **Any change** (`change`) passes the input when the watched value differs.
- **Becomes true** (`rise`) passes it when the value turns truthy — `false` to
  `true`, `0` to `3`.
- **Becomes false** (`fall`) passes it when the value turns falsy.

Otherwise it returns `null` and the pipeline stops there, like
[Filter](filter.md). What passes is always the **input itself**, unchanged — the
watched value only decides whether it goes on.

Values are compared by what they say: an object rebuilt on every input with the
same content is not a change.

It is the change-detection half of a problem [Debounce](debounce.md) does not
solve. Debounce limits how often something fires; a state that stays true still
fires once per cooldown. Changes fires once per change, however long the state
lasts — and the two combine, when a noisy source would otherwise flicker.

### What it remembers

Before the first input nothing has been seen, and the remembered value counts
as `undefined`: a truthy first value is a rise, any first value is a change,
and a falsy one is not a fall.

What it remembers is **live state**, shown in its panel, and not saved with the
board — like a Timer's `running`. A board opened again starts from nothing seen,
so a face already in view when it opens is reported. **Forget** in the panel (or
`reset`) clears it, and so does changing the watched expression.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `value` | `string` | `""` | An expression over `params` — what to watch. Empty watches the whole input |
| `emit` | `"change"` \| `"rise"` \| `"fall"` | `"change"` | Which change lets the input through |
| `reset` | `boolean` | — | Forgets what was remembered (an action, not state) |

The expression uses the same language and functions as [Map](map.md) and
[Filter](filter.md): `params.count > 0`, `params.status`, `round(params.level)`.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Anything |
| **Output** | The input, unchanged, when the watched value changed as `emit` asks; otherwise `null` |

---

## Typical uses

A face appears (see the [Face Alert](../boards/face-alert-board.md) board):

Timer → Camera → [Detect](detect.md) → **Changes** (`params.count > 0`, rise) → Debounce → Map → ntfy block

A reading moves to another level, reported once rather than every second:

Timer → Map `{ "level=": "round(rand() * 3)" }` → **Changes** (`params.level`) → Monitor
