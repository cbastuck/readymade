# HTTP

HTTP services: an outgoing client and an incoming server.

---

## Available in

| Runtime | Service IDs |
|---|---|
| hkp-rt | `http-client`, `http-server` |
| hkp-node | `http-client`, `http-server-subservices` |

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

### On hkp-node

The node implementation shares the configuration above (and therefore the same
UI panel), with these differences:

| Property | Type | Description |
|---|---|---|
| `__hkpMount` | `string` | Endpoint to call, as an address or a `hkp-mount://<runtimeId>/<serviceUuid>` reference. Takes precedence over `url` |
| `path` | `string` | Appended to the target, so a mount can be called at a sub-path |
| `timeoutMs` | `number` | Abort the request after this long (default `10000`) |

- It takes its body from the pipeline rather than from a URL template; `body`
  is used only when nothing came down the pipeline.
- Its output is `{meta, body?, binary?}` — the same shape
  `http-server-subservices` produces for an incoming request, so a request
  received on one runtime can be forwarded from another unchanged. `meta`
  carries `status`, `statusText`, `url` and `contentType`; the payload is
  decoded into `body` when the content type says what the bytes mean, and kept
  in `binary` when it does not.
- A failed request pushes nothing down the pipeline, rather than a fabricated
  result. A response with an error status *is* a result — the request completed,
  and what the server said is the board's business.
- Because the runtime calls services without awaiting them, the response cannot
  be returned from `process`; it does not exist yet. The service stops the push
  and calls the rest of the pipeline itself when the response arrives.

#### Calling an endpoint whose address is assigned at load time

A service that hosts an endpoint does not bind a port — its runtime assigns it a
path and publishes the address. That address is not knowable when a board is
written, so a client names the *service* instead:

```json
{
  "serviceId": "http-client",
  "state": {
    "__hkpMount": "hkp-mount://endpoint-node/echo-server",
    "path": "/hello"
  }
}
```

Resolving that reference belongs to whoever coordinates the board — a runtime
sees only its own services, while the reference names one somewhere else. The
coordinator hands over the address once the owner publishes it, and until then
the client waits rather than calling anything. See the mounts section of
`CLAUDE.md`.

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

## Typical pattern: API bridge

Expose a lightweight HTTP endpoint in hkp-rt that processes data and
sends the result to a browser:

```
http-server (port 8080) → map → websocket-server (port 8081)
Browser:  Input (ws://hkp-rt:8081) → Canvas
```
