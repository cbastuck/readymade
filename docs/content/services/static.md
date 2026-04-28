# Static

Emits a fixed JSON value on every pipeline tick, regardless of the incoming data.

---

## Available in

| Runtime | Service ID |
|---|---|
| hkp-rt | `static` |

---

## What it does

Static ignores whatever value arrives from the upstream service and always returns the configured `out` value. This makes it useful as a constant data source, a default value injector, or a way to reset a downstream service to a known state on every tick.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `out` | `any` | `null` | The JSON value to emit on every `process()` call |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any (ignored) |
| **Output** | The configured `out` value |

---

## Example: constant offset in a processing chain

```json
{
  "serviceId": "static",
  "state": { "out": { "offset": 100, "scale": 0.5 } }
}
```

Every upstream trigger produces `{ "offset": 100, "scale": 0.5 }` downstream regardless of what the upstream service emitted.
