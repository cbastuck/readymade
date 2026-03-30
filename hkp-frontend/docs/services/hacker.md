*Executes arbitrary JavaScript against the current pipeline value, with two safety variants.*

---

## Available in

| Runtime | Service IDs |
|---|---|
| Browser | `hookup.to/service/hacker/considered`, `hookup.to/service/hacker/dangerous` |

---

## What it does

Hacker lets you write a custom JavaScript function that is called on
each pipeline value. The return value of the function becomes the next
pipeline value. This is the escape hatch for any transformation that
cannot be expressed with Map, Filter, or other declarative services.

Two variants exist with different security boundaries:

| Variant | Security | Use case |
|---|---|---|
| `considered` | Sandboxed execution; no access to browser globals | Safe for shared boards; compute-only transforms |
| `dangerous` | Full browser environment access | DOM access, `fetch`, `localStorage`, etc. |

---

## Writing a Hacker function

The function receives `params` (the current pipeline value) and should
return the transformed value. Returning `null` stops the pipeline.

```javascript
// Example: extract and reshape a nested field
function process(params) {
  const { data: { readings } } = params;
  return readings.map(r => ({ t: r.timestamp, v: r.value }));
}
```

Async functions are supported:

```javascript
async function process(params) {
  const res = await fetch(`https://api.example.com/enrich?id=${params.id}`);
  return res.json();
}
```

> **`dangerous` only** — `fetch` and other browser APIs are not
> available in the `considered` variant.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `code` | `string` | `""` | The JavaScript source of the `process` function |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value, bound to `params` inside the function |
| **Output** | The function's return value, or `null` to stop the pipeline |

---

## Security notes

- **`considered`**: runs in a restricted environment; cannot access
  `window`, `document`, `fetch`, or any browser global. Safe to use
  with untrusted code.
- **`dangerous`**: runs in the full browser context. Only use with code
  you trust. Grants access to the DOM, network, storage, and any other
  browser capability.

When in doubt, prefer `considered` and use Map + Filter for
straightforward transforms.
