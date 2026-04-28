# Browser Sub-Service

Runs a nested pipeline inside a browser runtime, passing incoming data through it and emitting the final result.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `sub-service` |

---

## What it does

Browser Sub-Service embeds a complete inner pipeline (a `BrowserRuntimeScope`) inside a single service slot. Two modes are supported:

| Mode | Behaviour |
|---|---|
| `pipeline` | Instantiates the nested pipeline and routes each incoming value through it. The final output of the inner pipeline is emitted downstream. Asynchronous emissions from nested services (e.g. a Timer) are also forwarded to the outer pipeline. |
| `source` | Emits the full board descriptor JSON (runtimes + services) on `configure()` and `process()`. Used when the sub-service wraps a remote/phone runtime rather than running locally — downstream services (e.g. LZ Compress + QR Code) can embed the descriptor in a URL. |

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `mode` | `"pipeline"` \| `"source"` | `"pipeline"` | Operating mode |
| `boardName` | `string` | `""` | Display name for the nested board |
| `runtimeId` | `string` | `"browser-runtime"` | ID of the inner runtime |
| `runtimeName` | `string` | `"Browser Runtime"` | Display name of the inner runtime |
| `runtimeType` | `string` | `"browser"` | Runtime type tag |
| `pipeline` | `PipelineEntry[]` | `[]` | Ordered list of services in the inner pipeline |

### Pipeline entry shape

```json
{
  "serviceId": "hookup.to/service/map",
  "instanceId": "map-1",
  "serviceName": "Map",
  "state": { "template": { "=": "params.value * 2" } }
}
```

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value (piped into the inner pipeline) |
| **Output** | Result from the last service in the inner pipeline, or the board descriptor JSON in `source` mode |

---

## Relationship to hkp-rt sub-services

The `sub-service` serviceId mirrors the same concept in hkp-rt, hkp-node, and hkp-python. In all runtimes a sub-service instantiates and runs a nested pipeline as a single processing step.
