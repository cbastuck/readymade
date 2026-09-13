# HTTP

HTTP services: an outgoing client and an incoming server.

---

## Available in

| Runtime | Service IDs |
|---|---|
| hkp-rt | `http-client`, `http-server`, `http-server-subservices` |
| hkp-node | `http-client`, `http-server-subservices` |
| hkp-python | `http-client`, `http-server-subservices` |
| Browser | `http-client` |

The browser also has [Fetcher](./fetcher.md), the older outgoing service with a
contract of its own, and [Output](./output.md) for POST egress.

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

### On hkp-node, hkp-python and the browser

These implementations share the configuration above (and therefore, on the
remote runtimes, the same UI panel), with these differences:

| Property | Type | Description |
|---|---|---|
| `__hkpMount` | `string` | The resolved address of a mount, written by the board's coordinator. Takes precedence over `url`; not a field to author |
| `path` | `string` | Appended to the target, so a mount can be called at a sub-path |
| `query` | `object` | Request parameters as a map, encoded onto the target. Appended to any the target already carries, so a `url` or `path` written with parameters of its own keeps them. Numbers and flags are sent as the text they read as |
| `timeoutMs` | `number` | Abort the request after this long (default `10000`) |

- It takes its body from the pipeline rather than from a URL template; `body`
  is used only when nothing came down the pipeline.
- Its output is `{meta, body?, binary?}` — the same shape
  `http-server-subservices` produces for an incoming request, so a request
  received on one runtime can be forwarded from another unchanged. `meta`
  carries `status`, `statusText`, `url`, `headers` and `contentType`; the payload
  is decoded into `body` when the content type says what the bytes mean, and kept
  in `binary` when it does not.
- A failed request pushes nothing down the pipeline, rather than a fabricated
  result. A response with an error status *is* a result — the request completed,
  and what the server said is the board's business.
- Because the runtime calls services without awaiting them, the response cannot
  be returned from `process`; it does not exist yet. The service stops the push
  and calls the rest of the pipeline itself when the response arrives.
- While a request is in flight it says so (`requesting`), and every outcome names
  the `method` and the `url` actually called, the `status` (`0` when there was no
  response at all) and an `error` (empty when there was none) — so a panel shows
  this request's outcome rather than the previous one's still standing.

`http-client-demo-board.json` is that as an app: a facade that composes a
request — URL, path, parameters, headers, a JSON body — and sends it with the
verb you press, then reads the status, headers and body off what the Monitor
behind it received. The requests leave from the runtime rather than the browser,
which is the reason to call an API this way at all: no CORS policy has a say in
who can be called, and a credential in a header never reaches the page.

#### Calling an endpoint whose address is assigned at load time

Supported by every runtime's client (`__hkpMount` plus `path`; hkp-rt keeps its
URL templating for the `url` case).

A service that hosts an endpoint does not bind a port — its runtime assigns it a
path and publishes the address. That address is not knowable when a board is
written, so a client names the *service* instead, in the field it already calls
its target:

```json
{
  "serviceId": "http-client",
  "state": {
    "url": "hkp-mount://endpoint-node/echo-server",
    "path": "/hello"
  }
}
```

The coordinator resolves that and configures the client's `__hkpMount` with the
address, which then takes precedence. `url` is what a person writes and
`__hkpMount` is what the run produced, so neither overwrites the other and the
board keeps its reference when it is saved. A reference in either field means
the owner has not published yet, and the client waits rather than calling
anything. (Boards written before the split put the reference in `__hkpMount`;
they still work.)

Resolving that reference belongs to whoever coordinates the board — a runtime
sees only its own services, while the reference names one somewhere else. The
coordinator hands over the address once the owner publishes it, and until then
the client waits rather than calling anything. See the **Mounts** concept page
(`docs/content/concepts/mounts.md`) for why endpoints are assigned rather than
chosen, and who resolves a reference.

### In the browser

Same service id, same state, same response shape — so a board moves a request
between the browser and a runtime by moving the service, and the facade over it
does not change. `http-client-browser-demo-board.json` is exactly that: the demo
board above with its one runtime taken away.

What changes is not the contract but who makes the call. In the browser the page
does, which is the whole reason to choose it — there is no runtime to install,
start or reach — and the whole reason not to:

- The call goes through only where the API allows this origin. A blocked one
  fails as a bare network error, because the browser does not tell the page why.
- A credential in a header is in the page, and travels from the user's machine
  rather than from a server.
- `meta.headers` carries what the response *exposes*: everything, same-origin;
  cross-origin, the CORS-safelisted headers plus whatever the server named in
  `Access-Control-Expose-Headers`.
- `userAgent` is kept, so a board written on another runtime round-trips, but
  not sent: the browser reserves that header for itself.

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

### What answers the caller

Who handles a request depends on whether a nested pipeline is configured:

| Nested pipeline | Answer comes from |
|---|---|
| configured | the nested pipeline |
| none | the services after the server, and the rest of the board |

**With subservices**, the nested pipeline is the handler and what it returns is
what the caller gets. The services after the server still run, and their result
still drives the next runtime — but they run *after the answer is decided*.
That is where the side effects of having served a request belong: logging it,
forwarding it, notifying something.

**Without subservices**, the rest of the board is the handler. The request flows
into the services after the server and whatever they return is the answer. This
is the inversion of control the service is built around, and it is what lets a
board answer an endpoint at all.

Keeping the two apart is what makes a nested pipeline worth configuring: having
declared a handler, you can add services behind the server without silently
rewriting an HTTP contract from a distance. It also means a runtime that serves
an endpoint can be made terminal with a [Stopper](./stopper.md) — ending the
chain so it does not drive the runtime that calls it — while still answering its
callers normally.

### Where the nested pipeline is entered from

`mode` says which arrivals run the nested pipeline:

| `mode` | Requests | Data from the outer chain |
|---|---|---|
| `process_on_session` (default) | run the nested pipeline | passed through untouched |
| `process_on_data` | answered with the last value stored, verbatim | stored; the nested pipeline is not used |
| `process_on_both` | run the nested pipeline | runs the nested pipeline, and its result carries on down the chain |

`process_on_both` gives the nested pipeline two entry points. It is still a
single ordered list, and what one entry point produces is gone by the time the
other arrives — see [Hold](./hold.md), which keeps a producer's latest value
available to a caller that shows up later.

---

## Typical pattern: API bridge

Expose a lightweight HTTP endpoint in hkp-rt that processes data and
sends the result to a browser:

```
http-server (port 8080) → map → websocket-server (port 8081)
Browser:  Input (ws://hkp-rt:8081) → Canvas
```
