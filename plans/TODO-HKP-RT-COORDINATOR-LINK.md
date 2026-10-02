# Closing cloud boards: binary data, and hkp-rt as a participant

Status: **planned 2026-10-02, nothing built.** To be done on the
`coordinator_connections` branch, as one package that is tested once.

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

## Where things stand

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
3. `POST` / `GET /coordinator-links`, `DELETE /coordinator-links/<runtimeId>`,
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
  hkp-python, and stop binding ports of their own. See C5.
- **The image carries neither embedded llama.cpp nor embedded speech**
  (`HKP_LLAMA_ENABLED`, `HKP_SPEECH_ENABLED` both off). They would multiply the
  image size, and inference is expected to run as a sidecar anyway — a llama
  server beside the container performs better than one inside it. The services
  stay in the registry with their server backends: `text-generation`,
  `speech-to-text` and `text-to-speech` reach an OpenAI-compatible server by
  URL, which is how a board in the image uses a sidecar.

---

## Part A — binary data across a deployed board

### The shape

A binary WebSocket frame, on the link and on the bridge alike:

```
[ 4 bytes: header length, big-endian ][ header: UTF-8 JSON ][ payload: YAS ]
```

The header is the message that would have been sent as text, without its data:
`{ "type": "result" }`, `{ "type": "processRuntime", "context": … }`,
`{ "type": "processRuntime", "runtimeId": …, "requestId": … }` on the bridge.
The payload is the YAS encoding every codec already produces for a result.

**The coordinator reads the header and forwards the payload untouched.** It
needs no YAS codec, cannot corrupt what it does not parse, and adding a data
type later changes the runtimes and not the coordinator. JSON data keeps
travelling as text frames exactly as today, so nothing that works now changes.

Binary is for `result` and `processRuntime` only. A notification or a log entry
that carries bytes keeps the placeholder it has today: those are for a person
to read, and nothing downstream consumes them.

### Steps

**A1. Protocol.** `participantProtocol.ts` and `bridgeProtocol.ts`: the frame,
its header types, one `encodeBinaryMessage` / `decodeBinaryMessage` pair in
`hkp-node/src/coordinator/`. `Participant.process` and the bridge's
`processRuntime` accept either a value or an opaque payload.

**A2. Coordinator session.** `session.ts` carries a result as *value or
payload* from wherever it arrived to the next runtime, remote or browser. It
never inspects a payload. A payload is not written into a snapshot, a log line
or the board store; where the session keeps what a runtime last said, a
payload is recorded as its size only.

**A3. A YAS codec for hkp-node.** New `hkp-node/src/yas.ts`, ported from
`hkp-frontend/src/runtime/rest/Message.ts` (the two must agree, and a test
feeds each the other's bytes). Then:

- the link sends a binary frame for a result that is bytes, a ring buffer or
  mixed data, and decodes one arriving as `processRuntime`;
- hkp-node's *own* result socket does the same, which fixes the same gap for a
  node runtime driven straight from a browser. Small once the codec exists, and
  it removes a difference between servers that boards should not have to know
  about (`TODO-CONSOLIDATION.md`).

**A4. hkp-python link.** `coordinator_links.py` sends `serialize_message` output
as a binary frame instead of `_jsonable_result`'s placeholder, and decodes
incoming ones with `deserialize_message`.

**A5. Browser bridge.** `useCoordinatorBridge.ts` / `bridgeRuntimeApi.ts`:
`binaryType = "arraybuffer"`, decode an arriving payload with
`deserializeYasMessage`, encode a browser runtime's binary result with
`serializeYasMessage`.

**A6. hkp-rt.** Nothing separate: Part B builds its link with binary from the
start.

### Tests

- `hkp-node/tests/yas.test.ts`: round trips per type; fixtures produced by the
  frontend codec and by `hkp/yas.py` decode identically.
- `coordinator-session.test.ts`: a payload goes participant → participant and
  participant → bridge byte for byte; it is absent from the snapshot.
- `coordinator-python.test.ts`: bytes made on node arrive in python intact, and
  back.
- Frontend: bridge unit tests for both directions.
- `e2e/tests/cloud/deploy.spec.ts`: a deployed board whose node runtime emits
  bytes that a browser runtime displays.

---

## Part B — hkp-rt joins a coordinator

Each step leaves the tree working.

**B1. A reconnecting TLS WebSocket client.** New
`lib/src/common/link_socket.{h,cpp}`: `ws://` and `wss://`, a Bearer header on
the handshake, ping on an interval, text and binary frames both ways, and the
HTTP status of a refused upgrade surfaced to the caller — `401`/`403` is how a
coordinator says a ticket is dead. It runs on the app's existing `io_context`.
Kept apart from `websocket_client_session`, which the `websocket-client`
*service* uses and which should not change under boards that depend on it.
*Tests:* against an in-process Beast server — connects, is refused, pings,
reports a close code, carries a binary frame.

**B2. What the link needs of `App`.**
`App::setRuntimeState(runtimeId, json)` (logging on/off and level), also
exposed as `PATCH /runtimes/<id>/state`; `App::describeRuntime(runtimeId)` in
the shape `ReportedService[]`; and an output sink per runtime, called from
`Runtime::sendData` and the log target beside `Server::sendNotification`.
*Tests:* extend `runtime_log.test.cpp`, `runtime_lifecycle.test.cpp`.

**B3. The link.** New `lib/include/coordinator_links.h`,
`lib/src/coordinator_links.cpp` — a port of the node module with the same
behaviour, including what was not obvious there:

- `hello` carries `server: "c++"`, the registry, `runtimeExists`;
- `provision` builds with `garbageCollected` unset and the secrets handed over
  at introduction, and answers with registry, services and `missingSecrets`;
- `remove` of a runtime that is not there succeeds;
- close `4403` (revoked) and `4409` (replaced), and a `401`/`403` on the
  upgrade, are final: drop the link **and remove the runtime**. Anything else
  reconnects with backoff;
- replacing a link's ticket does not tear the running runtime down first;
- secrets are held in memory with the link, never written with the ticket;
- results that are not JSON go out as Part A's binary frame, and a binary
  `processRuntime` is decoded with the existing `Message` codec;
- every operation is posted to the app's event loop (`App::postCallback`).

Ticket store: an interface with a file implementation (atomic write, `0600`)
and a memory one for tests. The **host** supplies the path.
*Tests:* `tests/coordinator_links.test.cpp` against a fake coordinator on the
B1 test server — the cases of `hkp-node/tests/coordinator-links.test.ts`.

**B4. Routes and hosts.** `POST /coordinator-links` `{ coordinatorUrl, ticket,
boardName, runtimeId, secrets? }`, answering once the first connection attempt
has an outcome; `GET` lists; `DELETE` removes one — all behind
`AuthMiddleware`. `GET /runtimes` adds `coordinatorLinks: true` when the host
gave a store. `meander/backend/main.cpp` passes
`~/.hkp/cpp/coordinator-links.json` and restores at start; iOS and Android pass
none.
*Tests:* `http_server_lifecycle.test.cpp`.

---

## Part C — hkp-rt standalone: reachable, authenticated, in a container

**C1. Open binding.** `exe/main.cpp` takes a bind address — `HKP_BIND`,
default `127.0.0.1` — separate from the external address it advertises.

**C2. Auth from the environment**, named as hkp-node names them:
`AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `ALLOWED_EMAILS`, building the `AuthConfig`
the embedded hosts already build. **Fail-closed:** a non-loopback bind without
all three refuses to start, with a message naming what is missing. A loopback
bind needs none, as today.

**C3. The rest of what a server away from a desk needs:**
`HKP_COORDINATOR_LINKS_FILE` (default `~/.hkp/cpp/coordinator-links.json`),
restored at start; `HKP_EXTERNAL_URL` for the address it publishes when it sits
behind a TLS-terminating proxy; allowed CORS origins from the environment
rather than `*` once it is exposed; `SIGTERM` closes links and exits cleanly.

**C4. The image.** `hkp-rt/Dockerfile`, multi-stage: build with vcpkg on a
Linux base, run from a slim one as a non-root user, `EXPOSE` the port, a volume
for `~/.hkp`. Linux is not `IS_MACOS`, so `core-input` / `core-output` are
absent — which the registry already reports and the preflight already checks.
Built with `HKP_LLAMA_ENABLED=OFF` and `HKP_SPEECH_ENABLED=OFF`; a board
choosing an embedded backend there gets that service's existing "not built in"
error, naming the backend.

**C5. Mounts on the server's own port — decided 2026-10-02.** On par with
hkp-node and hkp-python, and overdue regardless of containers.

Today `http-server` and `http-server-subservices` each bind **their own port**
on `0.0.0.0` (`http_server_impl.cpp`) and publish
`http://<primary LAN IPv4>:<port>` (`primaryIPv4()` in
`http_server_subservices.cpp`). That was tolerable with one hkp-rt per machine.
It is not with several — two hkp-rt processes on one machine collide on
whatever port a board names — and in a container the published address is the
container's internal one, each endpoint needs its own published port, and none
sits behind the proxy the server itself sits behind.

So an endpoint becomes a path on the server it already runs in:

- `/hosted/<mountId>` on the Crow server, outside `AuthMiddleware` — the
  unguessable id is the gate, as on the other two servers.
- The id is derived, not drawn: an HMAC of board, runtime and mount name
  (`mountName`, defaulting to the service uuid) under a secret the server holds
  (`HKP_MOUNT_SECRET`, else `~/.hkp/cpp/mount-secret`, `0600`, supplied by the
  host like the ticket file). Same derivation as hkp-node, so an address
  survives restarts and redeploys.
- The published address is built from `HKP_EXTERNAL_URL` when set, else from
  the server's own bind and port.
- The services stop binding. `host` and `port` in their config are accepted and
  ignored, and say so once in the log, so an old board loads rather than fails.
  The Beast listener in `services/http_server/` goes; request handling, the
  `meta`/`body`/binary contract and `stream` fan-out move onto Crow routes.
- `peer-server` binds its own port too (HTTP and WebSocket on one, default
  OS-assigned) and gets the same treatment: its signalling moves under
  `/hosted/<mountId>`, including the WebSocket upgrade, as hkp-node's does.

What changes for boards: an endpoint's address is no longer `:<port>` chosen by
the board. `boards/live-location-demo-board.json` is the one shipped board that
names a port (`8080`, on the iOS runtime) — it and its docs page are updated,
and anything outside the repo that was configured with `http://<phone>:8080`
needs the new address. Boards that reference an endpoint
(`hkp-mount://<runtime>/<service>`) need nothing.

*Tests:* a mount test suite for hkp-rt mirroring `hkp-node/tests/mounts.test.ts`
(stable across restart, rotates with the name, unreachable without the id);
`service_http_client_mount.test.cpp` and `http_server_lifecycle.test.cpp`
updated; two hkp-rt processes on one machine both serving an endpoint; the
image smoke test calls a mounted endpoint from outside the container.

*Tests (C1–C4):* `auth.test.cpp` gains the environment parsing and the fail-closed
start; a shell smoke test builds the image, starts it with and without auth
variables, and checks `GET /runtimes` answers `401` without a token and `200`
with one.

---

## Part D — testing the package

### Automated

| What | Where |
|---|---|
| YAS in hkp-node, cross-codec fixtures | `hkp-node/tests/yas.test.ts` |
| Payloads through a session, untouched | `hkp-node/tests/coordinator-session.test.ts` |
| Bytes between node and python on a deployed board | `hkp-node/tests/coordinator-python.test.ts` |
| hkp-rt's socket, link, routes | `hkp-rt/tests/link_socket.test.cpp`, `coordinator_links.test.cpp`, `http_server_lifecycle.test.cpp` |
| A board across hkp-node and hkp-rt, both restarts | new `hkp-node/tests/coordinator-rt.test.ts`, modelled on the python one; skipped when the binary is not built |
| A ring buffer from hkp-rt arriving in node and in a browser | the same file, and `e2e/tests/cloud/deploy.spec.ts` |
| Standalone auth and bind | `hkp-rt/tests/auth.test.cpp`, the image smoke test |
| Preflight accepts an hkp-rt that can join | `hkp-frontend/src/core/tests/deployPreflight.test.ts` |

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

## Order and size

| | Rough size | Depends on |
|---|---|---|
| A1–A2 protocol, session | 1 day | — |
| A3 YAS in hkp-node | 1–1.5 days | — |
| A4–A5 python link, bridge | 1 day | A1 |
| B1 link socket | 1 day | — |
| B2 `App` operations | 0.5 day | — |
| B3 the link | 2 days | A1, B1, B2 |
| B4 routes, desktop host | 0.5 day | B3 |
| C1–C3 standalone | 1 day | B4 |
| C4 image | 1 day, mostly build time | C1–C3 |
| C5 mounts on the server's port, incl. `peer-server` | 3 days | C3 |
| D cross-boundary tests, manual pass, docs | 1.5 days | all |

About thirteen to fourteen days. **Part A first**: it is testable with node and python
alone, so it is verified before any C++ is written and B3 is built against a
protocol that already carries binary. **B1 next**, because it carries the risk
— TLS, reconnect and thread ownership in Beast.

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

## Docs, when it lands

`docs/content/concepts/remotes.md` (which servers can join; the binary frame),
`cloud-boards.md` (the `cannot-join` row), `coordinator.md`, `targets.md` (the
image), `testing.md`, the READMEs of the three servers, `CLAUDE.md`, and
`/vocabulary` over the changeset. This plan's conclusions move there and the
file is deleted.
