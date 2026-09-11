# Hacker

Evaluates a single sandboxed expression against the current pipeline value.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/hacker/considered` |

---

## What it does

Hacker holds one expression, written in the same dialect
[Map](./map.md) uses for its dynamic terms, and evaluates it on every
pipeline value. The result of the expression becomes the next pipeline
value. It is the escape hatch for a computation that does not fit a
declarative service, while staying inside a sandbox: the expression is
parsed into an AST and evaluated against a fixed scope, so it cannot
reach `window`, `document`, `fetch` or any other browser global.

The service is named "Considered Hacker" in the service list.

---

## Writing an expression

The incoming pipeline value is bound to `params`, and the built-in
functions listed in [Map's expression scope](./map.md#expression-scope)
are in scope:

```
round(sin(params.triggerCount * 0.05) * 220 + 300)
```

```
concat('hsl(', (params.triggerCount * 37) % 360, ',70%,60%)')
```

An expression is a single expression — not a function body. There are no
statements, no variable declarations, and no object or array literals. To
build an object, follow Hacker with a [Map](./map.md) whose template
holds the structure and whose dynamic terms hold the computation —
`boards/hacker-demo-board.json` does exactly that.

Returning `null` stops the pipeline. When the expression throws or fails
to parse, the service reports the error on its health indicator and
emits `null`.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `buffer` | `string` | `""` | The expression to evaluate |
| `size` | `[number, number]` | — | Editor size in pixels |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value, bound to `params` inside the expression |
| **Output** | The expression's value, or `null` on error or to stop the pipeline |

---

## Notes

- Side effects are limited to what the scope offers — `toVault` writes a
  value to the user vault, `print` logs to the console.
- For straightforward reshaping prefer [Map](./map.md), and for
  predicates prefer [Filter](./filter.md); Hacker is for the computation
  in between.
