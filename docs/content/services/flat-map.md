# FlatMap

Applies an expression to each item in an array and concatenates all results into a single flat array.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/flat-map` |

---

## What it does

FlatMap wraps the Map service's expression evaluator with a flattening step. For each element in the input (or for the single input if it is not an array), the `expression` is evaluated with `params` set to that element. All results are concatenated (`Array.flat(1)`); `null` and `undefined` results are dropped.

If the expression returns an array for each item, FlatMap effectively expands nested arrays into a single level — hence the name.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `expression` | `string` | `""` | Expression evaluated per input item. Should return an array or a value. Uses the same expression syntax and built-in functions as the [Map](./map.md) service. |

If `expression` is empty, the input is passed through unchanged.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value or array of values |
| **Output** | Flat array of all non-null expression results |

---

## Example: extract all tags from a list of posts

```json
{ "expression": "params.tags" }
```

Input:
```json
[
  { "title": "A", "tags": ["js", "react"] },
  { "title": "B", "tags": ["css"] }
]
```

Output: `["js", "react", "css"]`

---

## Expression scope

FlatMap uses the same expression engine and built-in functions as [Map](./map.md). The variable `params` refers to the current item being processed.
