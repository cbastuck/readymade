# Buffer

Accumulates pipeline values into an array and flushes them as a batch when a capacity or time threshold is reached.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/buffer` |

---

## What it does

Buffer collects incoming values and holds them in an internal array. The accumulated batch is emitted downstream in two ways:

- **Capacity flush** — when the number of buffered items reaches `capacity`, the batch is emitted and the buffer is cleared.
- **Interval flush** — when `interval` is set, a timer fires every `interval` milliseconds and emits the current contents (even if not full), then clears the buffer.

Both can be active simultaneously; whichever threshold is crossed first triggers the flush.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `capacity` | `number` | `100` | Maximum number of items before an automatic flush |
| `interval` | `number` | `-1` | Flush interval in milliseconds. `-1` disables timer-based flushing |
| `accumulatedOutput` | `boolean` | `false` | When `true`, each flush emits the full accumulated buffer since the last `clear` rather than just the current window |
| `action: "clear"` | — | — | Discards all buffered items |
| `command: { action: "flush" }` | — | — | Immediately flushes the current buffer |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value (arrays are concatenated into the buffer) |
| **process() return** | Always `null` — flushing happens asynchronously via `app.next()` |
| **Flush emission** | Array of all buffered values |

---

## Example: batch 20 events then process

```json
{
  "serviceId": "hookup.to/service/buffer",
  "config": { "capacity": 20 }
}
```

Incoming values accumulate silently until 20 have arrived; then the array of 20 is emitted downstream.

---

## Example: flush every 2 seconds

```json
{
  "serviceId": "hookup.to/service/buffer",
  "config": { "interval": 2000, "capacity": 10000 }
}
```

Whatever has accumulated over the past 2 seconds is emitted as a batch, regardless of count.
