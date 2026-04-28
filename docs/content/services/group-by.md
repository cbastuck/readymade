# Group By

Groups or aggregates an array of objects by a named property, producing either a histogram or a sum.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/group-by` |

---

## What it does

Group By receives an array of objects and reduces it along a single property. Two modes are available:

| Mode | Output |
|---|---|
| `histogram` | An object mapping each distinct value of `property` to its count, e.g. `{ "cat": 5, "dog": 3 }` |
| `sum` | The sum of the `property` values across all items in the array |

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `property` | `string` | `""` | Name of the key to group by or sum |
| `mode` | `"histogram"` \| `"sum"` | `"histogram"` | Aggregation mode |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Array of objects |
| **Output (histogram)** | `{ [value]: count }` |
| **Output (sum)** | `number` |

Non-array inputs are returned as-is (with a console warning in `sum` mode).

---

## Example: count label occurrences

```json
{ "property": "label", "mode": "histogram" }
```

Input: `[{ "label": "cat" }, { "label": "dog" }, { "label": "cat" }]`
Output: `{ "cat": 2, "dog": 1 }`
