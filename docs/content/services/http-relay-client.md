# HTTP Relay Client

Polls a server-side relay endpoint and serves responses to incoming HTTP requests by running them through a configurable inner pipeline.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/http-relay-client` |

---

## What it does

HTTP Relay Client bridges a server-side HTTP relay (a PHP script that buffers requests) with browser-side pipeline processing. It polls the relay endpoint every 500 ms. When a pending request arrives (with its query parameters), those parameters are piped through an inner pipeline (a `BrowserRuntimeScope`). The pipeline's result is then POSTed back to the relay as the HTTP response body.

This pattern lets a browser act as an HTTP server without requiring a persistent server connection — the relay stores incoming requests until the browser polls for them.

The polling loop stops when the service is bypassed and resumes when bypass is removed.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `pollUrl` | `string` | `""` | URL to poll for pending requests |
| `respondUrl` | `string` | `""` | URL to POST the pipeline result back to |
| `authVaultKey` | `string` | `""` | Vault key for an optional bearer token injected into poll/respond requests |
| `bypassAfterNumberOfPolls` | `number \| null` | `100` | Auto-bypass after this many polls; `null` to disable |
| `pipeline` | `PipelineEntry[]` | `[]` | Inner pipeline applied to each incoming request's query params |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Pass-through (relay is driven by the polling loop, not by pipeline input) |
| **Output** | Pass-through |

---

## Typical use

Deploy a lightweight PHP relay on a server. Configure HTTP Relay Client with the relay's `pollUrl` and `respondUrl` and an inner pipeline that processes each query string object. The browser becomes a headless HTTP responder.
