# Debounce

Rate-limits a pipeline by suppressing values that arrive before a configurable cooldown has elapsed.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/debounce` |

---

## What it does

Debounce tracks the timestamp of the last value it forwarded. When a new value arrives, it computes the elapsed time since the last forward. If the elapsed time is less than `cooldown` seconds, the value is dropped (returns `null`) and the remaining cooldown is reported to the UI. If the cooldown has elapsed, the value is forwarded and the timestamp is reset.

This is useful for noisy event sources such as button presses, sensors, or user interactions where you want at most one trigger per `cooldown` window.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `cooldown` | `number` | `60` | Minimum time between forwarded values, in seconds |
| `reset` | `boolean` | — | When `true`, clears the last-fired timestamp so the next value is forwarded immediately |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value |
| **Output** | The input value if the cooldown has elapsed; `null` otherwise |

---

## UI feedback

The UI panel shows:
- `lastFired` — timestamp (ms) of the last forwarded value
- `remaining` — integer seconds until the cooldown expires; `null` when idle
