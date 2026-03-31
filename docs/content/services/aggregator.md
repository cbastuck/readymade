# Aggregator

Counts occurrences of values in a named property and periodically emits the most frequent value seen.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/aggregator` |

---

## What it does

Aggregator is a frequency-based smoother. On every pipeline trigger it
records the value of a configured property in a histogram. At a fixed
time interval it emits the **mode** (most frequently seen value) and
resets the histogram. This smooths out noisy or rapidly changing
categorical signals — for example, a classifier that oscillates between
two labels will resolve to whichever label appeared more often in the
window.

Unlike most services, Aggregator does **not** return a value from its
`process()` call. Instead it emits independently on its own timer via
`app.next()`. The output therefore arrives at the next service on a
schedule, not in response to upstream triggers.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `property` | `string` | `"unset"` | Name of the key to aggregate across incoming objects |
| `interval` | `number` | `100` | Emission interval in milliseconds |

### How aggregation works

1. Each incoming value's `property` field is recorded in an internal
   histogram: `{ value → count }`.
2. Every `interval` ms the histogram is examined and the value with the
   highest count is selected.
3. That value is emitted as `{ [property]: winnerValue }`.
4. The histogram is cleared.

When the input is an array, all elements are aggregated in the same
window.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Object (or array of objects) with the configured `property` key |
| **process() return** | Always `null` — no synchronous downstream emission |
| **Timer emission** | `{ [property]: mostFrequentValue }` |

---

## Example

Smooth a noisy label signal arriving at 20 Hz, emitting the winner
every 500 ms:

```json
{
  "property": "label",
  "interval": 500
}
```

Input over 500 ms: `cat, cat, dog, cat, dog, dog, dog, cat, cat, cat`
Output: `{ "label": "cat" }` (6 vs 4)
