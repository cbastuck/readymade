# Configurator

Routes a pipeline value to another service's `configure()` call instead of continuing downstream.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/configurator` |

---

## What it does

Configurator is the dedicated routing primitive for dynamic reconfiguration. When a value arrives, Configurator calls `configure()` on the target service with the incoming value as the configuration payload, then either stops the pipeline chain (`passThrough: false`, default) or passes the original value downstream (`passThrough: true`).

This separates concerns cleanly: Map transforms data, Configurator routes configuration — without coupling the upstream producer or the downstream target.

### Cross-runtime targeting

Set `targetRuntime` to configure a service in a different runtime (e.g. a remote hkp-rt instance). When `targetRuntime` is omitted, the target is looked up in the same runtime via `app.getServiceById()`.

### Optional inner pipeline

A `pipeline` list can be set to transform the incoming params before they reach the target service's `configure()`. This lets you reshape the upstream value into whatever shape the target's configure protocol expects — without touching either end.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `targetServiceUuid` | `string` | `""` | UUID of the service to configure |
| `targetRuntime` | `string` | `undefined` | Runtime ID for cross-runtime targeting; omit for same-runtime |
| `passThrough` | `boolean` | `false` | When `true`, the original value continues downstream after configuring the target |
| `pipeline` | `PipelineEntry[]` | `[]` | Optional transform pipeline applied to params before `configure()` is called |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value — passed as-is (or through `pipeline`) to the target's `configure()` |
| **Output** | `null` (chain stops) when `passThrough: false`; original input when `passThrough: true` |

---

## Example: update a Map template from a Timer

```json
[
  { "serviceId": "hookup.to/service/timer", "config": { "periodic": true, "periodicValue": 5, "periodicUnit": "s" } },
  {
    "serviceId": "hookup.to/service/configurator",
    "config": {
      "targetServiceUuid": "<uuid-of-map-service>",
      "passThrough": false
    }
  }
]
```

Every 5 seconds the timer tick is sent directly to the Map service's `configure()`, allowing dynamic template updates.
