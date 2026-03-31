# Looper

Records a sequence of pipeline values and replays them at the original timing.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/looper` |

---

## What it does

Looper captures all data values that pass through it while in **record**
mode, preserving the timestamps between each value. When switched to
**play** mode, it replays the recorded sequence at the same pace —
emitting each value via `app.next()` with the same delay between events
as the original recording.

This makes Looper useful for recording live gestures, sensor streams, or
interactive performances and replaying them deterministically.

---

## Modes

| Mode | Behaviour |
|---|---|
| **Record** | Passes data through unchanged; stores each value with its arrival timestamp |
| **Play** | Ignores incoming pipeline data; replays the recording at original timing |
| **Stop** | Neither records nor plays; passes data through like a bypass |

---

## Input / Output

| | Shape |
|---|---|
| **Input (record mode)** | Any value — stored and passed downstream |
| **Input (play mode)** | Ignored |
| **Output (play mode)** | Each recorded value, emitted at original inter-event timing via `app.next()` |

---

## Typical use

- Record a live XY pad performance, then play it back in a loop while
  adjusting other parameters.
- Capture a data stream from an external sensor for offline development
  without needing the sensor connected.
- Create generative patterns by recording a short motif and looping it.

```
XYPad → Looper → Map → Canvas
```

While Looper is in record mode, XY gestures pass through to Canvas in
real time and are stored. Switch to play mode: Looper replays the
gesture in a loop, freeing the XY pad.
