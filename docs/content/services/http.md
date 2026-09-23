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
| `url` | `string` | Request URL, written in full — authority and path together |
| `method` | `string` | HTTP method (`GET`, `POST`, `PUT`, `DELETE`, …) |
| `headers` | `object` | Request headers as key-value pairs |
| `body` | `string \| object` | Request body (for POST/PUT) |

### Input / Output

- **Input**: any value; may be merged into the request body
- **Output**: HTTP response body, parsed as JSON if the Content-Type is `application/json`, otherwise a string

#### A request that says where it is going

`path` and `method` are configuration, which is right for a service calling one
endpoint over and over. Where a board calls a *different* address per item — an
episode written to its own path, a record fetched by its own id — the input may
say so, in the same envelope the response comes back in:

```json
{
  "meta": { "method": "put", "path": "/episodes/one.mp3", "contentType": "audio/mpeg" },
  "binary": "…the bytes…"
}
```

What the input leaves unsaid stays as configured, so a board that names neither
is unaffected. `path` is a sub-path of a mount, exactly as the configured field
is: a typed URL carries its own path and is not rewritten from a distance.

On hkp-node.

### On hkp-node, hkp-python and the browser

These implementations share the configuration above (and therefore, on the
remote runtimes, the same UI panel), with these differences:

| Property | Type | Description |
|---|---|---|
| `__hkpMount` | `string` | The resolved address of a mount, written by the board's coordinator. Takes precedence over `url`; not a field to author |
| `path` | `string` | The sub-path of a **mount**, and of nothing else. A `url` is a whole URL and carries its own path, so `path` is ignored when the target is one |
| `query` | `object` | Request parameters as a map, encoded onto the target — every target, unlike `path`, because escaping is a service a map performs and a written URL cannot. Appended to any the target already carries, so a `url` or `path` written with parameters of its own keeps them. Numbers and flags are sent as the text they read as |
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

This is what `path` is for. A mount's address is assigned by a runtime and
resolved by the coordinator, so it is not the board's to write — which leaves a
sub-path of it nowhere else to go. A typed `url` has somewhere: itself.

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

### What a handler may answer with

An answer is JSON unless the handler says otherwise, which is what every board
got before there was a way to say anything else. To say otherwise, return the
request envelope read backwards — `meta` beside `body` or `binary`:

```json
{
  "meta": { "status": 200, "contentType": "application/rss+xml" },
  "body": "<?xml version=\"1.0\"?><rss version=\"2.0\">…</rss>"
}
```

| Field | Means |
|---|---|
| `meta.status` | the response status, **and what marks this as an answer** |
| `meta.contentType` | the `content-type` header |
| `meta.headers` | any other headers, by name |
| `binary` | the bytes to send |
| `body` | a string, sent as text; anything else, sent as JSON |

**The status is what distinguishes an answer from a request.** A request and a
response are the same shape, so a pipeline that passes its input through returns
a request — and reading any `meta` as an answer would silently reply with the
caller's own content type. A request carries no status; a response always does.
It is also what [http-client](#http-client) reports a response as, so a board
that proxies one endpoint to another passes what it got straight back.

Raw bytes on their own are sent as `application/octet-stream`, because there is
no JSON encoding of them anybody wanted.

**Byte answers are seekable.** A `Range` header is honoured against the bytes
the handler produced, and answered `206` with a `content-range`. That is what a
player dragging a scrubber sends, and a server that ignores it re-sends the whole
file each time.

Available on hkp-node and hkp-python.

### The two ways in

An endpoint is entered from two sides, and they are different jobs: a **request**
arriving from outside, and a **pass** of the board's own chain flowing through.
A board names the pipelines it wants for them.

```json
{ "onRequest": [ … ] }                        // requests; a pass goes through
{ "onProcess": [ … ] }                        // passes; the board answers
{ "onProcess": [ … ], "onRequest": [ … ] }    // both, separately
{ "pipeline":  [ … ] }                        // one pipeline, entered from both
```

**Declaring `onRequest` is what takes the answer away from the chain.** With
one, that pipeline is the handler: what it returns is what the caller gets. The
services after the endpoint still run — that is where a board reacts to having
served a request — but after the answer is decided. Without one, the request
flows into the services after the endpoint and whatever they return is the
answer, which is the inversion of control this service is built around.

So an endpoint can have something to run on a pass — counting it, logging it —
without silently becoming an HTTP handler.

`pipeline` is the way to say *one pipeline, both entries*, which is the only way
the two sides can share a service's state: they are one running thing rather
than two.

### Publishing a document

A pass ends where it ends, so a value it produced is gone by the time a request
arrives. An endpoint that publishes what the board last handed it keeps that
value in a **slot** — cells the endpoint owns and lends to both its pipelines:

```json
{
  "onProcess": [ { "serviceId": "hold", "state": { "slot": "document", "op": "write" } } ],
  "onRequest": [ { "serviceId": "hold", "state": { "slot": "document", "op": "read"  } } ]
}
```

See [Hold](./hold.md). Nothing here inspects the value, so anything can be
published this way — a feed, a playlist, an audio file — and the two Holds may
sit in pipelines that never meet.

Because the answer is decided at the endpoint, a runtime may publish **more than
one document**: two endpoints in one chain, each answering what reached it. The
services after an endpoint still run on every request, though, so a feed and a
playlist are better off one runtime each: a request should not drag a tail of
SQL behind it.

### The older spelling

Boards written before the entry points had names carry a `mode` beside a single
`pipeline`, and still load:

| `mode` | Means |
|---|---|
| `process_on_session` | `onRequest` ← the pipeline |
| `process_on_both` | both entries ← the same pipeline |
| `process_on_data` | the slot arrangement above, built in and unnamed |

It is the same endpoint either way. What `mode` could not express is an
endpoint with a pipeline for passes and no handler — under the older rule,
having a pipeline at all decided who answered.

---

## Typical pattern: API bridge

Expose a lightweight HTTP endpoint in hkp-rt that processes data and
sends the result to a browser:

```
http-server (port 8080) → map → websocket-server (port 8081)
Browser:  Input (ws://hkp-rt:8081) → Canvas
```
