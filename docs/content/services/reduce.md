# Reduce

Folds a stream of pipeline values into a single accumulated result using a user-defined reducer expression.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/reduce` |

---

## What it does

Reduce maintains an internal `reducedState` across successive pipeline ticks. On each `process()` call, the configured `reducer` expression is evaluated with `params` set to the current input and the accumulated state accessible as a second argument. The expression's return value becomes the new `reducedState` and is emitted downstream.

This is conceptually equivalent to `Array.prototype.reduce` applied to a live stream over time.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `initialState` | `any` | `undefined` | Starting value for `reducedState`. Also resets the accumulator when updated. |
| `reducer` | `string` | `""` | Expression evaluated per tick. Uses the same expression syntax as [Map](./map.md). |
| `resetReducer` | `boolean` | `false` | When `true`, resets `reducedState` back to `initialState` on next configure call |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value — available as `params` in the reducer expression |
| **Output** | The accumulated `reducedState` after applying the reducer |

---

## Example: running total

```json
{
  "initialState": 0,
  "reducer": "params.value + state"
}
```

Each tick adds the incoming `value` to the running total. (Exact expression syntax depends on how `state` is bound in the expression scope — consult the Map service expression reference.)
