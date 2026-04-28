# Select

Picks a single element from an array by zero-based index.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/select` |

---

## What it does

Select returns the element at position `arrayIndex` from an array input. If the input is not an array, or if `arrayIndex` has not been configured, the input is returned unchanged with a console warning.

Use Select after services that emit arrays (e.g. [Buffer](./buffer.md), [Filter](./filter.md), [Sort](./sort.md)) when you want to extract a specific element for downstream processing.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `arrayIndex` | `number` | `undefined` | Zero-based index of the element to return |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Array (preferred); any value |
| **Output** | `params[arrayIndex]` for array inputs; original value otherwise |

---

## Example

```json
{ "arrayIndex": 0 }
```

Input: `["first", "second", "third"]`
Output: `"first"`
