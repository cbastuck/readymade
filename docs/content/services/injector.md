# Injector

Injects a configured static value into the pipeline, replacing or providing the current data.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/injector` |

---

## What it does

Injector stores a value (set via its UI or configuration) and emits it
on every pipeline trigger instead of the incoming data. If no value has
been configured, it falls back to passing the incoming data through
unchanged.

The most common use is to provide a constant payload — a fixed API
request body, a default configuration object, or a test fixture — that
can be swapped in and out without changing the upstream pipeline.

Injector can also be triggered imperatively: sending
`command.action: "inject"` with a value causes it to fire immediately,
bypassing the normal pipeline flow.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `inject` | `any` | `undefined` | Value to store and emit. Setting this fires an immediate `app.next()` |
| `recentInjection` | `any` | `undefined` | Restore the last injected value on board load (set automatically) |
| `plainText` | `boolean` | `false` | Treat the stored value as a plain string rather than parsed JSON |

### Behaviour

| Condition | Output |
|---|---|
| `recentInjection` is set | Emits `recentInjection` on every trigger |
| `recentInjection` is unset | Passes incoming `params` through unchanged |

Setting `inject` both stores the value as `recentInjection` AND
immediately calls `app.next()` with the value, triggering the downstream
pipeline without waiting for an upstream event.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value (used as fallback when no injection is set) |
| **Output** | The configured `recentInjection` value, or the input if none is set |

---

## Example: fixed API request body

Store a JSON object that is always sent by the downstream Fetcher:

```json
{
  "recentInjection": { "query": "SELECT * FROM events LIMIT 100", "format": "json" }
}
```

## Example: fire a one-time trigger

Send a specific payload immediately via `configure`:

```json
{
  "inject": { "action": "reset", "timestamp": 0 }
}
```

This stores the value AND fires it immediately through the downstream
pipeline.
