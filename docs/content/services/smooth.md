# Smooth

Applies an exponential moving average (EMA) to numeric pipeline values to reduce noise and sharp transitions.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/smooth` |

---

## What it does

Smooth maintains a running `current` value. On each tick it blends the incoming value toward `current` using the formula:

```
current += (target - current) * factor
```

- `factor = 0` — frozen (current never changes)
- `factor = 1` — instant tracking (output equals input)
- `factor = 0.1` — slow, heavily smoothed follow

On the very first tick the `current` is initialised directly to the input (no blending).

For object inputs, the EMA is applied independently to each numeric property. Non-numeric properties are copied as-is.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `factor` | `number` | `0.1` | EMA blend factor, clamped to [0, 1] |
| `reset` | `boolean` | — | When `true`, clears `current` so the next tick re-initialises from scratch |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | `number` or object with numeric fields |
| **Output** | Same shape as input, with values blended toward the target |

`null` inputs are returned as-is without affecting the running average.

---

## Example: smooth a noisy sensor reading

```json
{ "factor": 0.05 }
```

A `factor` of `0.05` produces a very sluggish follow suitable for dampening jittery sensor data or camera-based position estimates.
