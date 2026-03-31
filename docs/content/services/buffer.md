# Buffer

Accumulates pipeline values until a capacity or time threshold is reached, then emits the batch.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/buffer` |
| hkp-rt | `buffer` |

---

## What it does

Buffer collects incoming pipeline values into an internal array. It emits
a batch when either:

- The number of collected items reaches **`capacity`**, or
- A **`interval`** timer fires (if configured)

Until the emit condition is met, `process()` returns `null`, halting the
downstream pipeline. Once a batch is emitted, the buffer is cleared.

---

## Browser configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `capacity` | `number` | `100` | Number of items that triggers a batch emit |
| `interval` | `number` | `-1` | Seconds between timed emits; `-1` disables |
| `accumulatedOutput` | `boolean` | `false` | If `true`, emit the current (incomplete) buffer on every trigger |
| `action: "clear"` | command | — | Immediately clear the internal buffer |

### `capacity` vs `interval`

Both can be active simultaneously:

- **Capacity only** (`interval: -1`): emits exactly when the buffer
  reaches `capacity` items.
- **Interval only** (`capacity: 0`): emits on the timer regardless of
  count; does nothing if the buffer is empty at fire time.
- **Both**: whichever condition fires first triggers the emit. The timer
  is rescheduled after each emit.

### `accumulatedOutput`

When `true`, the entire current buffer is returned on every trigger
(even before the threshold is reached), enabling a live-growing window.
The buffer is NOT cleared in this mode — only a capacity overflow or
manual `action: "clear"` clears it.

---

## hkp-rt configuration

The hkp-rt buffer handles both JSON and raw binary data.

| Property | Type | Default | Description |
|---|---|---|---|
| `size` | `number` | — | Number of items (JSON) or byte count (binary) to buffer |
| `binary` | `boolean` | `false` | Operate in binary mode (accumulates raw bytes) |
| `clearBufferAfterPropagation` | `boolean` | `true` | Clear buffer after emitting |

In binary mode the buffer accumulates raw byte arrays and emits them as
a single contiguous byte array when `size` bytes have been collected.
This is suited for audio streaming: `core-input → buffer → fft`.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value (or array — elements are appended individually) |
| **Output (threshold not met)** | `null` — pipeline stops |
| **Output (threshold met)** | Array of buffered items |

---

## Example: batch 10 sensor readings before processing

```json
{ "capacity": 10, "interval": -1 }
```

Every 10th reading, the buffer emits `[reading1, reading2, …, reading10]`
to the next service.

## Example: sliding window every 2 seconds

```json
{ "capacity": 0, "interval": 2 }
```

Emits whatever has accumulated every 2 seconds, regardless of count.
