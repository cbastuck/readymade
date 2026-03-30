*Evaluates one or more boolean expressions against the pipeline data and either passes it through or stops the pipeline.*

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/filter` |

---

## What it does

Filter evaluates a set of expressions against the current pipeline value.
If the result is truthy, the original input is passed to the next service
unchanged. If the result is falsy, the service returns `null`, stopping
the pipeline at that point.

When the input is an array, each element is tested individually. Elements
that pass the condition are kept; elements that fail are removed. If all
elements are removed the service returns `null`.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `conditions` | `string \| string[]` | `[]` | One or more expression strings to evaluate |
| `aggregator` | `"and" \| "or"` | `"and"` | How multiple conditions are combined |

### `conditions`

Each condition is a JavaScript expression string evaluated against the
pipeline input. The expression receives the following scope:

- **`params`** — the current pipeline value (the full input object or
  array element being tested)
- All built-in functions from the expression scope (see the
  [Map service](./map.md#expression-scope) for the full list)

A condition should evaluate to a truthy or falsy value. Examples:

```
params.score > 80
params.status === "active"
params.tags && params.tags.includes("urgent")
```

### `aggregator`

When multiple conditions are provided:

| Value | Behaviour |
|---|---|
| `"and"` (default) | All conditions must be truthy for data to pass |
| `"or"` | Any single truthy condition allows data to pass |

> **Note:** With a single condition the aggregator has no effect.

> **Note — empty conditions:** If no conditions are configured the
> service blocks everything and always returns `null`.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any JSON value |
| **Output (pass)** | Original input, unchanged |
| **Output (block)** | `null` — stops the pipeline |
| **Array input** | Elements are tested individually; non-matching elements are removed |

---

## Examples

### Threshold guard

Allow only values where a numeric property exceeds a threshold:

```json
{
  "conditions": "params.temperature > 37.5",
  "aggregator": "and"
}
```

### Multiple conditions with AND

Require both a minimum score and an active status:

```json
{
  "conditions": [
    "params.score >= 60",
    "params.status === \"active\""
  ],
  "aggregator": "and"
}
```

### Any-of with OR

Pass through if either of two urgent signals is set:

```json
{
  "conditions": [
    "params.priority === \"high\"",
    "params.overdue === true"
  ],
  "aggregator": "or"
}
```

### Filtering an array

If the pipeline value is an array (e.g. from a Buffer), only elements
matching the condition are kept:

```json
{
  "conditions": "params.value > 0"
}
```

Input `[{ "value": 3 }, { "value": -1 }, { "value": 7 }]`
→ Output `[{ "value": 3 }, { "value": 7 }]`
