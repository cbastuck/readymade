# Limit

Truncates an array to at most `n` elements.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/limit` |

---

## What it does

Limit takes an array input and returns only the first `n` elements. Non-array values are passed through unchanged.

Use Limit after services that produce variable-length arrays (such as [Filter](./filter.md), [FlatMap](./flat-map.md), or [Sort](./sort.md)) to cap the output to a known maximum size.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `n` | `number` | `10` | Maximum number of elements to keep. Must be ≥ 1. |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Array (or any value) |
| **Output** | First `n` elements of the array; original value if not an array |

---

## Example

```json
{ "n": 5 }
```

Input: `[1, 2, 3, 4, 5, 6, 7, 8]`
Output: `[1, 2, 3, 4, 5]`
