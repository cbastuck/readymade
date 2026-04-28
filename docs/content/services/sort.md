# Sort

Sorts an array of objects by a named property in ascending or descending order.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/sort` |

---

## What it does

Sort receives an array of objects and returns a new sorted array. Sorting is done by comparing the value of the `by` property across each object. Non-array inputs are passed through unchanged.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `by` | `string` | `""` | Name of the property to sort by |
| `dir` | `"asc"` \| `"desc"` | `"desc"` | Sort direction |

If `by` is empty or the input is not an array, the input is returned unchanged.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Array of objects |
| **Output** | Sorted copy of the array |

---

## Example

```json
{ "by": "score", "dir": "desc" }
```

Input: `[{ "name": "A", "score": 3 }, { "name": "B", "score": 7 }, { "name": "C", "score": 1 }]`
Output: `[{ "name": "B", "score": 7 }, { "name": "A", "score": 3 }, { "name": "C", "score": 1 }]`
