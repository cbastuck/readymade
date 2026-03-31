# HTTP

HTTP services for the hkp-rt runtime: an outgoing client, an incoming server, and a static file host.

---

## Available in

| Runtime | Service IDs |
|---|---|
| hkp-rt | `http-client`, `http-server`, `static` |

For browser-side HTTP, use [Fetcher](./fetcher.md) (outgoing) and
[Output](./output.md) (POST egress).

---

## http-client

### What it does

Makes outgoing HTTP requests and emits the response body downstream. The
request fires on each pipeline trigger, making it the server-side
equivalent of the browser's [Fetcher](./fetcher.md) service.

### Configuration

| Property | Type | Description |
|---|---|---|
| `url` | `string` | Request URL |
| `method` | `string` | HTTP method (`GET`, `POST`, `PUT`, `DELETE`, …) |
| `headers` | `object` | Request headers as key-value pairs |
| `body` | `string \| object` | Request body (for POST/PUT) |

### Input / Output

- **Input**: any value; may be merged into the request body
- **Output**: HTTP response body, parsed as JSON if the Content-Type is `application/json`, otherwise a string

---

## http-server

### What it does

Hosts an HTTP server. Each incoming HTTP request triggers the downstream
pipeline with the request data as its input. Useful for receiving
webhooks, building internal APIs, or accepting data from external services.

### Configuration

| Property | Type | Description |
|---|---|---|
| `host` | `string` | Interface to bind (e.g. `"0.0.0.0"`) |
| `port` | `string \| number` | Port to listen on |

### Input / Output

- **Input**: not used (server triggers itself on incoming requests)
- **Output**: incoming HTTP request data (method, path, body, headers)

---

## static

### What it does

Serves files from a local directory over HTTP. This is a passive service
that handles its own HTTP lifecycle independently of the pipeline. Use it
alongside `http-server` or WebSocket services to serve the frontend
assets for a self-hosted board.

### Configuration

| Property | Type | Description |
|---|---|---|
| `root` | `string` | Filesystem path to the directory to serve |
| `host` | `string` | Interface to bind |
| `port` | `string \| number` | Port to listen on |

### Input / Output

- Passes pipeline data through unchanged; HTTP serving happens as a
  side-effect independently of the pipeline.

---

## Typical pattern: API bridge

Expose a lightweight HTTP endpoint in hkp-rt that processes data and
sends the result to a browser:

```
http-server (port 8080) → map → websocket-server (port 8081)
Browser:  Input (ws://hkp-rt:8081) → Canvas
```
