# Closing cloud boards: binary data, and hkp-rt as a participant

Status: **built 2026-10-02**, on the `coordinator_connections` branch, except
for what is listed under *Left to do*: the Docker image builds but has not been
run, the manual pass has not been made, and three things are deliberately not
done.

Two gaps keep cloud boards from being finished:

- **A deployed board cannot pass binary data between runtimes**, on any runtime
  server. Part A.
- **hkp-rt cannot take part in a deployed board at all**, and a standalone
  hkp-rt cannot be reached from anywhere but its own machine. Parts B and C.

They are done together because they meet: hkp-rt is the runtime whose data is
mostly binary, so bringing it in without Part A would deliver a participant
that cannot say much. Part D is how the whole thing is tested, and it is part
of the package rather than an afterthought.

Companions: `TODO-COORDINATOR-CONNECTIONS.md` (the link, as built for hkp-node
and hkp-python), `docs/content/concepts/remotes.md` (how it works today). The
reference implementations of the link are `hkp-node/src/coordinatorLinks.ts` and
`hkp-python/src/hkp/coordinator_links.py`; the wire format is
`hkp-node/src/coordinator/participantProtocol.ts`.

---

## The link, in one paragraph

The browser deploying a board tells each runtime server *connect to this
coordinator with this ticket* (`POST /coordinator-links`). The server opens a
WebSocket to `<coordinator>/coordinator/join` with the ticket as a Bearer
credential, says `hello` (its kind, its registry, whether the runtime already
exists there), and from then on answers six things over that socket —
`provision`, `describe`, `configureService`, `setState`, `remove`,
`processRuntime` — and sends back what the runtime says: `result`,
`notification`, `log`. It keeps the ticket on disk and reconnects with it, with
nobody present.

---

## Where things stood, before

### Binary data, per transport

| | hkp-node | hkp-python | hkp-rt | browser |
|---|---|---|---|---|
| YAS codec | **none** | `hkp/yas.py` | `types/message.{h,cpp}` | `runtime/rest/Message.ts` |
| Its own result socket | JSON only (`sendJsonResult`) | binary frames for bytes and ring buffers | binary frames | reads both |
| Coordinator link | JSON only | JSON only — bytes become a placeholder (`_jsonable_result`) | no link | — |
| Coordinator bridge | — | — | — | JSON only (`bridgeProtocol.ts`) |

So the limit is not in one place. The coordinator's two transports — the link
to runtime servers and the bridge to browsers — are both JSON text, the session
between them forwards `data` as a JavaScript value, and hkp-node has never had a
binary wire format on any transport: a `Uint8Array` a node service returns is
`JSON.stringify`'d wherever it goes.

It has not bitten because the boards deployed so far pass JSON between
runtimes.

### What hkp-rt has, and lacks, for the link

It already says its kind and registry (`GET /runtimes`), builds a runtime from
a description and replaces by id (`App::createRuntime`), persists one that did
not ask to be cleaned up, describes, configures and removes, drives a pipeline
with a run context (`ProcessContext::fromJson`), takes secrets it never gives
back and tracks missing aliases (`lib/include/secrets.h`), has a logging switch
and level on `Runtime`, gates every route (`AuthMiddleware`), and links Beast
SSL with vendored root certificates for its JWKS fetch.

It lacks:

1. An outbound WebSocket client that does TLS, reconnects, pings, and sends a
   Bearer header on the handshake. `lib/src/common/websocket_client_session` is
   plain `ws://` with none of those.
2. The link: ticket records, the `hello`, the six operations, close codes,
   backoff.
3. `POST` / `GET /coordinator-links`, `DELETE /coordinator-links/<board>/<runtimeId>`,
   and `coordinatorLinks: true` in `GET /runtimes`.
4. A second place for a runtime's output to go. `Runtime::sendData` and the log
   target hand everything to `Server::sendNotification`, which fans out to
   browser sockets only.
5. Somewhere to keep tickets. The library has no notion of a home directory.
6. A way to change logging on a running runtime (the others have
   `PATCH /runtimes/:id/state`).

### What a standalone hkp-rt lacks

`exe/main.cpp` takes `<port> <externalIP> <config>`, always binds `127.0.0.1`,
and passes no `AuthConfig`. The browser must reach a runtime server to load a
board on it and to make the introduction, so a standalone hkp-rt on another
machine is unusable today — with or without a coordinator. There is no
Dockerfile for any runtime server in the repo.

---

## Decided

- **Binary data across a deployed board is in scope, now** (2026-10-02). It is
  a gap in cloud boards generally, and closing it here means the topic is
  closed once rather than reopened and retested.
- **hkp-rt joins on standalone and desktop.** Standalone is what a Docker image
  on a VPS runs. On iOS and Android the server reports
  `coordinatorLinks: false`: a phone suspends the app, the link drops and the
  board goes to `error`, so the preflight should keep saying so beforehand.
- **Links in hkp-rt have no owner.** hkp-rt is single-tenant — one id space, an
  email allowlist, a loopback bypass carrying no identity. Whoever may create a
  runtime there may link one, which is who the introduction comes from.
- **The coordinator does not decode what it forwards.** See Part A.
- **The protocol sets no ceiling on a binary frame.** What a board may pass
  between runtimes in the playground it may pass when deployed. Two things
  follow, because "no ceiling" does not happen by leaving it alone:
  - every WebSocket library on the path has a default one, and exceeding it
    closes the connection (`1009`) — which a coordinator reads as a participant
    going away and puts the board in `error`. Each is raised explicitly: `ws`
    (`maxPayload`, 100 MiB), aiohttp (`max_msg_size`, 4 MiB), Beast
    (`read_message_max`, 16 MiB);
  - a coordinator is shared, and it holds a whole frame in memory once per
    connected viewer. So the *operator* gets a limit —
    `HKP_COORDINATOR_MAX_FRAME_BYTES`, **unset by default** — beside the
    per-tenant quotas hkp-node already has (`maxRequestBodyBytes`, 25 MiB). A
    frame over it is dropped with a log entry naming the runtime and the size;
    the connection stays up.
- **hkp-rt endpoints mount on the server's own port**, as on hkp-node and
  hkp-python. Built for the standalone server; the apps are an open decision.
  See C5 and *Left to do*.
- **The image carries neither embedded llama.cpp nor embedded speech**
  (`HKP_LLAMA_ENABLED`, `HKP_SPEECH_ENABLED` both off). They would multiply the
  image size, and inference is expected to run as a sidecar anyway — a llama
  server beside the container performs better than one inside it. The services
  stay in the registry with their server backends: `text-generation`,
  `speech-to-text` and `text-to-speech` reach an OpenAI-compatible server by
  URL, which is how a board in the image uses a sidecar.

---

## Part A — binary data across a deployed board

**Built 2026-10-02** for the coordinator, hkp-node, hkp-python and the browser
bridge. How it works is in `docs/content/concepts/cloud-boards.md` ("Bytes
between runtimes"). What is left of it is hkp-rt's end, which Part B builds.

### The shape, as built

A binary WebSocket frame, on the link and on the bridge alike:

```
[ 4 bytes: header length, big-endian ][ header: UTF-8 JSON ][ payload ]
```

The header is the message that would have been sent as text, without its value
and with a `binary` field saying what the payload is:

| `binary.kind` | Payload | Also in the header |
|---|---|---|
| `bytes` | the value | — |
| `floatRingBuffer` | little-endian float32 samples | `id`, `ts` |
| `mixed` | the bytes of an object's `binary` field | `json`: the rest of the object |

The coordinator reads the header and forwards the payload untouched
(`BinaryPayload` in `hkp-node/src/coordinator/binaryFrame.ts`). JSON keeps
travelling as text frames. Binary is for `result` and `processRuntime` only; a
notification or a log entry that mentions bytes keeps its placeholder.

### Changed while building: the payload is not YAS

The plan said "the payload is the YAS encoding every codec already produces".
Reading the codecs showed they do not produce one encoding:

- the frontend's serialises only ring buffers and null, and reads no
  `BinaryData`;
- hkp-rt's reads only ring buffers and null;
- the ring buffer has two dialects (a `uint16` or a `uint32` type id), which
  hkp-python detects by length;
- **mixed data — bytes with JSON beside them, which is what an HTTP response or
  a file read is on every runtime — has no YAS encoding anywhere.** hkp-rt
  reserves a type id for it and serialises it nowhere.

Building on that would have meant a new codec for hkp-node plus extensions to
the other three, to get an envelope (purpose, sender, nested header) the link
has no use for. The frame already has a JSON header, so the header says what
the bytes are and the payload is just the bytes. Each runtime needs about
thirty lines and no codec.

**Dropped with it: A3, a YAS codec for hkp-node.** hkp-node's own result
socket to a browser is still JSON only — a node runtime driven straight from
the playground still cannot hand the browser bytes. That is a difference
between runtime servers, not a cloud-board gap, and belongs to
`TODO-CONSOLIDATION.md`.

### What each runtime maps the shapes to

| | `bytes` | `floatRingBuffer` | `mixed` |
|---|---|---|---|
| hkp-node | `Uint8Array` | `{ type: "FloatRingBuffer", id, ts, binary }` — it has no ring buffer of its own, and sends that shape back out as one | `{ …json, binary: Uint8Array }` |
| hkp-python | `BinaryData` (and raw `bytes` on the way out) | `FloatRingBuffer` | `{ …json, "binary": bytes }` |
| browser | `Uint8Array` (and `ArrayBuffer` on the way out) | `FloatRingBuffer` | `{ …json, binary: Uint8Array }` |
| hkp-rt (Part B) | `BinaryData` | `FloatRingBuffer` | `MixedData` — `json.meta` ↔ `meta` |

### The operator's limit

`HKP_COORDINATOR_MAX_FRAME_BYTES`, unset by default. It applies to any frame a
joined participant or an attached browser sends, text or binary; an oversized
one is dropped and recorded in the board's log as `frame-dropped`, and the
connection stays up. A `hello` is exempt — it carries a registry, and a limit
meant for values must not keep a runtime server from joining. It bounds what
is forwarded and fanned out, not what is received: the frame is in memory by
the time it is measured.

The libraries' own ceilings are off on every connection involved (`ws`
`maxPayload: 0`, aiohttp `max_msg_size=0`).

### Tests

- `hkp-node/tests/coordinator-binary.test.ts`: the frame; what node sends as
  bytes; a session forwarding a payload as the same object; bytes, mixed and
  JSON between two real runtime servers; through an attached browser and on;
  the limit.
- `hkp-node/tests/coordinator-python.test.ts`: bytes, mixed and a ring buffer
  from node into a real hkp-python and back out, unchanged.
- `hkp-python/tests/test_coordinator_links.py`: bytes and a ring buffer in and
  out over the link; the mapping; malformed frames.
- `hkp-frontend/src/views/cloud/tests/bridge-binary.test.tsx`: the frame, the
  mapping, and the bridge hook handing a browser runtime bytes and answering
  with them.
- One hex fixture, written by hkp-node's encoder, is decoded by all three.

**Not done:** the Playwright spec with a real browser. A node runtime only
emits bytes on its own from a file read or an HTTP fetch, and the browser
Monitor's rendering of them is not something to assert on. It is better
written against an hkp-rt board that draws a ring buffer, in Part D.

---

## Part B — hkp-rt joins a coordinator

Each step leaves the tree working.

**B1. A TLS WebSocket client — built.** `lib/src/common/link_socket.{h,cpp}`
(`LinkSocket`): `ws://` and `wss://`, a Bearer header on the handshake, text
and binary frames both ways, no message-size ceiling, pings when idle and
closes when a ping goes unanswered, and reports how it ended — the HTTP status
of a refused upgrade, or the close code. TLS verifies the peer's certificate
*and* its host name, against the vendored roots plus an optional extra root
(`trustedRootPem`, for a coordinator behind a private CA).

It does **not** reconnect: a connection is one attempt, and whether to make
another is the link's decision (B3), which is where the node implementation
has it too. Kept apart from `websocket_client_session`, which the
`websocket-client` *service* uses.

*Tests:* `tests/link_socket.test.cpp`, 13 cases against a real websocket peer
on loopback, plain and over TLS with a certificate made for the run — including
a refused upgrade, a close code, a peer that goes silent, a 20 MiB message, and
a TLS peer it has no reason to trust (which never sees the credential).

**B2. What the link needs of `App` — built.**
`App::setRuntimeState(runtimeId, json)` (logging, level, `logData`), also
exposed as `PATCH /runtimes/<id>/state` so hkp-rt matches the other two; and
`App::setRuntimeOutputSink` — one sink per runtime, called on the event loop
from `Runtime::sendData` and `forwardLog` beside the sockets, with the value as
it is rather than a serialised frame. A sink survives the runtime being
rebuilt under its id, which is what a coordinator's `provision` does.
Describing a runtime needed nothing new: `App::getServices` already answers in
the shape the link reports.
*Tests:* `tests/runtime_output_sink.test.cpp`, 7 cases.

**B3. The link — built.** `lib/include/coordinator_links.h`,
`lib/src/coordinator_links.cpp`, with `lib/src/binary_frame.h` for the frame. A
port of the node module with the same behaviour: the `hello`, the six
operations, `4403`/`4409` and a refused upgrade as final (the link is dropped
**and the runtime removed**), backoff, a replaced link leaving the runtime in
place, secrets held in memory, tickets in a file written atomically and `0600`.

Two things differ from the plan:

- **A coordinator's requests run on a thread of their own, not on the app's
  event loop.** A pipeline may run for a while, and the connection it arrived on
  has to go on answering pings meanwhile, or the coordinator takes the runtime
  for gone after two heartbeats. One thread, so what a coordinator asks happens
  in the order it asked. The socket, timers and link state stay on the event
  loop.
- **A run's result is not sent by the link.** In hkp-rt every run's result
  leaves through the runtime's output (`Runtime::onProcessEnd` → `sendData`),
  which the link listens to — so a result produced by a `processRuntime` and
  one the runtime produces on its own travel the same way, once.

*Tests:* `tests/coordinator_links.test.cpp`, 24 cases against a fake
coordinator speaking the protocol, including the node-written frame fixture.

**B4. Routes and hosts — built.** `POST` / `GET /coordinator-links`,
`DELETE /coordinator-links/<board>/<runtimeId>`, all behind `AuthMiddleware`;
`coordinatorLinks` in `GET /runtimes` says whether the host turned it on
(`Server::enableCoordinatorLinks`). The standalone server and the desktop app
do, keeping tickets in `~/.hkp/cpp/coordinator-links.json`; iOS and Android do
not. The desktop app was built with it (`xcodebuild`, Debug) and **not run**.
The routes are tested over HTTP by `hkp-node/tests/coordinator-rt.test.ts`
rather than in C++, where a second server cannot be started in one test binary.

---

## Part C — hkp-rt standalone: reachable, authenticated, in a container

**C1–C3 — built.** `lib/include/standalone_config.h` reads a standalone
server's arguments and environment, and `exe/main.cpp` acts on it. The names
are hkp-node's — `HOST` and `PORT` rather than the `HKP_BIND` first planned — so
one environment file describes either server:

| | |
|---|---|
| `HOST`, `PORT`, `EXTERNAL_HOST` | what it listens on and says of itself; `127.0.0.1:5556` unless said. The arguments it always took still override |
| `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `ALLOWED_EMAILS` | all three required for a bind that is not loopback: without them it **refuses to start**, naming what is missing |
| `ALLOWED_ORIGINS` | browser origins allowed to call it |
| `HKP_EXTERNAL_URL` | where it is reached from outside; mounts are published under it |
| `HKP_MOUNT_SECRET` | else kept at `~/.hkp/cpp/mount-secret` |
| `HKP_COORDINATOR_LINKS_FILE` | else `~/.hkp/cpp/coordinator-links.json`; empty keeps tickets in memory |

`SIGTERM` and `SIGINT` close links and stop the server.

*Tests:* `tests/standalone_config.test.cpp`, 10 cases. By hand, on the built
binary: refusal on `HOST=0.0.0.0` without auth; with auth, a caller on loopback
is let in, one on the LAN address gets `401`, with or without forged headers.

**C4. The image — builds; not yet run.** `hkp-rt/Dockerfile` and
`hkp-rt/Dockerfile.dockerignore`: multi-stage on `ubuntu:24.04`, vcpkg at the
commit the repository pins, the same cmake options `run-tests.sh` uses with the
three ML backends off, a non-root user, `~/.hkp` as a volume, port 8887. It
built on the first attempt (about nine minutes cold, almost all of it vcpkg
compiling Boost and OpenSSL), which also settles that hkp-rt compiles with gcc
on Linux with the new sources. Running it — the refusal without auth, a
ticket surviving a restart on the volume, an endpoint reached from outside —
is in the manual pass. Building and running are described in
`hkp-rt/README-docker.md`.

**C5. Mounts on the server's own port — built for the standalone server.**

Not built as planned. The plan moved request handling onto the REST framework's
routes; that cannot be done, because **Crow cannot stream a response** and an
hkp-rt endpoint does: a binary answer is an open-ended chunked stream fed by
every later pass (that is what a live audio endpoint is), and `peer-server`
upgrades to a WebSocket. So the services keep their own socket handling, and
the server's port becomes a **front door** (`lib/src/http/front_door.cpp`):

- a connection whose first request is for `/hosted/<id>` is handed, socket and
  bytes already read, to the service owning the mount (`MountedConnection`);
- anything else is passed through to the REST api, which now listens on
  loopback on a port the OS picks.

What that costs, and how it is handled:

- **One request per connection.** Who a connection belongs to is decided on its
  first request, so what is passed through is marked `Connection: close` (an
  upgrade excepted). No keep-alive for api calls.
- **The api's loopback trust.** It lets the machine's own UI in without a
  token, by the caller's address; passed through, every caller is this process.
  The front door passes the real address in `X-Hkp-Client`, believed only
  beside `X-Hkp-Front` — a secret drawn per process — and strips both from
  what a caller sent.

The id is hkp-node's derivation with an empty tenant, checked against a value
computed by node. `http-server`, `http-server-subservices` and `peer-server`
mount when the server offers it and bind a port when it does not; mounted,
`host` and `port` are accepted and not acted on, and `mountName` names the
mount.

**On for the standalone server only.** See *Left to do* for the apps.

*Tests:* `tests/mounts.test.cpp` (10 cases: derivation, the secret file, what
the front door makes of a request head); `hkp-node/tests/coordinator-rt.test.ts`
on the running binary — the address, an unknown mount, the same address after a
restart, two servers on one machine serving one board, `HKP_EXTERNAL_URL`, and a
runtime's notification socket through the front door.

---

## Part D — testing the package

### Automated — done

| What | Where | Result |
|---|---|---|
| The frame, a session forwarding payloads, the limit | `hkp-node/tests/coordinator-binary.test.ts` | pass |
| Bytes, mixed, ring buffer: node ↔ python | `hkp-node/tests/coordinator-python.test.ts` | pass |
| The same through hkp-rt; a board across node and hkp-rt; restart; deletion; mounts | `hkp-node/tests/coordinator-rt.test.ts` (13) | pass |
| The browser's end of the bridge | `hkp-frontend/src/views/cloud/tests/bridge-binary.test.tsx` | pass |
| hkp-rt: socket, sink, link, standalone config, mounts | `hkp-rt/tests/` (246, of which 64 new) | pass |
| A real browser deploying a board on hkp-rt | `e2e/tests/cloud/deploy-rt.spec.ts` | pass |
| Preflight accepts an hkp-rt that can join | `hkp-frontend/src/core/tests/deployPreflight.test.ts` | pass |

Suites as last run: hkp-node 799, hkp-python 373, hkp-frontend 2058 (+1
skipped), hkp-rt 246, Playwright cloud 6. The full main Playwright suite was
not rerun; its shipped-board browser sweep passed all 70 cases (including the
declared expected failure for the retired Reduce service).

**Not automated:** bytes arriving in a *real* browser. The bridge's end is
covered with a fake socket, and both runtime-server ends against real servers,
but no spec watches a browser runtime display a ring buffer on a deployed
board.

### By hand, once, at the end

Setup: a coordinator `C`; hkp-node `N`; hkp-python `P`; desktop app with its
embedded hkp-rt `R`; the Docker image running on another machine as `D`.

What was already built, and must still hold:

- [ ] `boards/remote-named-demo-board.json` on `N`: loads, saves with `remote`
      and no `url`; with the remote renamed, the load fails naming it.
- [ ] A runtime with both `remote` and `url` is refused, and neither address is
      requested. One with only `requires` is placed nowhere.
- [ ] A node-and-python board deploys; with the browser closed it keeps
      running; stopping `N` puts it in `error` naming the runtime, starting it
      recovers; restarting `C` brings it back; deleting it removes the runtimes.

Part A:

- [ ] Bytes from `N` to `P`, and back, on a deployed board.
- [ ] Bytes from `N` into a browser runtime in the cloud view.

Parts B and C:

- [ ] `boards/remote-named-demo-board-hkp-rt.json` on `R`: loads, ticks, saves
      with `remote` and no `url`.
- [ ] Deploy it to `C`. Close the app's window: the board keeps ticking
      (`GET <C>/coordinator/users/<sub>/boards/<name>`).
- [ ] Quit the desktop app → the board is in `error`, naming the runtime.
      Start it → the board recovers without redeploying.
- [ ] Restart `C` → the board comes back and `R` rejoins on its own.
- [ ] Delete the board on `C` → the runtime is gone from `R`, and
      `GET <R>/coordinator-links` is empty.
- [ ] A board with audio leaving `R` (FFT or a ring buffer) into a browser
      runtime: it plays or draws in the cloud view as it does in the playground.
- [ ] The same data from `R` into `N` and into `P`.
- [ ] `D` started without auth variables on `0.0.0.0` → refuses to start and
      says why.
- [ ] `D` with them: added as a remote, a board names it, loads, deploys;
      restart the container → it rejoins from the ticket on its volume.
- [ ] `D` with an account not on its allowlist → the deploy dialog says the
      server refused this account, and nothing is handed over.
- [ ] A board on `D` with an HTTP endpoint: the address it publishes answers
      from another machine, and is the same after the container restarts.
- [ ] A large payload (tens of MB) from one runtime to the next on a deployed
      board arrives whole; with the operator limit set below it, the board
      stays `running` and the log names the dropped frame.
- [ ] The phone app as a remote → the deploy dialog says it cannot join.

---

## Left to do

- **Run the image.** It builds; the container items of the manual pass have
  not been done.
- **The manual pass** above. None of it has been done.
- **Mounts in the apps — a decision, not a task.** Today an endpoint in the
  desktop app binds every interface whatever the app's *external access*
  setting says, which is what lets a phone reach it. Mounted, it is reachable
  only as far as the server's port is: loopback, unless external access is on.
  Turning mounts on in the desktop app therefore means the front door listening
  on every interface and refusing the api to anyone but the machine itself —
  a change to the app's exposure. On the phones it is the same question plus an
  untested platform. Until decided, the apps bind ports as before and
  `boards/live-location-demo-board.json` is unchanged.
- **hkp-node's own result socket is JSON only.** A node runtime driven straight
  from the playground cannot hand the browser bytes. Not a cloud-board gap;
  `TODO-CONSOLIDATION.md`.
- **A real-browser test for bytes** on a deployed board (see Part D).
- **The mobile deploy sheet** still reports what stopped a deploy as a toast.

---

## Known rough edges this does not fix

- **Runtime state in hkp-rt is not mutex-guarded** though REST, the
  notification socket and timers touch it from different threads. Posting every
  link operation to the event loop avoids adding to it; it does not make it
  right.
- **Credentials after a restart** are lost on hkp-rt as on the other two: the
  ticket survives, the values do not, and the board names what is missing until
  it is deployed again.

---

## Docs

Done: `docs/content/concepts/remotes.md` (which servers join),
`cloud-boards.md` (bytes between runtimes, the `cannot-join` row), `mounts.md`
(hkp-rt's front door, and the apps as a gap), `targets.md` (the standalone
server and the image), `testing.md`, `hkp-node/README.md`, `CLAUDE.md`; the
vocabulary's references still resolve. When the items above are settled, what
remains here moves there and this file is deleted.
