# Switch

Passes any pipeline value through unchanged — an identity service used as a named connection point.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/switch` |

---

## What it does

Switch is a transparent pass-through service. It performs no transformation: whatever value arrives is returned as-is. Its purpose is structural — it serves as a labelled node in a board that other services can route through, making the board's flow explicit without adding any processing logic.

---

## Configuration

None. Switch accepts but ignores all configuration.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value |
| **Output** | Identical to input — passes through unchanged |

---

## Comparison

| Service | Effect |
|---|---|
| Switch | Pass-through (identity) |
| [Stopper](./stopper.md) | Always returns `null` |
| [Monitor](./monitor.md) | Pass-through + logs to UI |
