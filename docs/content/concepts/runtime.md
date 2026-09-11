# Runtime

Where services actually run. A board has one or more, they are chained in order, and each one is a place with different capabilities — a browser tab, a Node process, a Python process, a C++ binary.

---

## Why there is more than one

A board is one app, but the things an app does do not all belong in the same
place. Drawing on a canvas belongs in the browser. Reading IMAP belongs on a
server. Running Whisper belongs where the model is. Audio DSP belongs in C++.

A **runtime** is that place. Splitting a board across several is what lets one
app span them, and the chain between them is what makes it one app rather than
several.

| Runtime | Language | How the browser talks to it | Typically used for |
|---|---|---|---|
| Browser | TypeScript | direct JS call — same process as the UI | UI, interaction, fast iteration, most services |
| hkp-node | TypeScript | REST + WebSocket | messaging, server I/O, webhooks |
| hkp-python | Python | REST + WebSocket | AI/ML, model inference |
| hkp-rt | C++ | REST + WebSocket | audio, high performance, embedded in the app |
| hkp-go | Go | REST | in development |
| GraphQL | — | GraphQL | legacy; one integration |

Not every service exists on every runtime. Where the same service id exists in
two runtimes it is meant to be the same *concept* with the same state contract —
`http-client` in node and hkp-rt share a UI panel for exactly that reason.

### Choosing where a step runs is a real decision

The same step can often be placed in more than one runtime, and where you put it
decides three things that no amount of configuration can change afterwards:

**Where the data goes.** A runtime is a physical place. A step in the browser
runtime on your laptop keeps its data on your laptop; the same step in a runtime
on a server puts that data on the server. This is not a privacy policy, it is
which machine the bytes are on. A board that transcribes a recording locally and
sends only the resulting text onwards is not promising that — it is what the
board does.

**What it can reach.** A runtime can touch only what its host can touch: the
microphone and camera of the device in your hand, an audio interface plugged
into it, files on that machine, a device on that network segment and nothing
else. If a board needs a thing, it needs a runtime on the host that has it.

**What it can afford.** Compute, memory, and the models installed. A phone can
drive a small speech model; a workstation can run a large one; a cheap always-on
box can do neither but never sleeps. Placement is how the work is matched to the
hardware — which is why the same service ids exist on several runtimes, so
moving a step is moving it in the list rather than rewriting it.


### Choosing, in practice

Four worked cases, to make those three axes concrete:

**Transcribing a private recording.** The audio should not leave the device, and
transcription needs a model. Put speech-to-text in a local runtime — hkp-rt
embedded in Readymade, or hkp-python on your own machine — and let only the
resulting text continue. The privacy property is structural: no step in the
board sends audio anywhere.

**A chat bot that answers while you sleep.** None of it can live in a browser,
because there is no browser open. Messaging belongs in hkp-node on a server, and
the board wants deploying so a coordinator keeps it running — see
`concepts/cloud-boards.md`.

**A live audio analyser with a UI.** Split it: capture and FFT in hkp-rt where
the sample buffers are, the display in the browser runtime where the person is.
What crosses between them is the analysis, not the audio.

**A model too big for your laptop.** Put hkp-python on the machine that has the
memory and leave everything else where it was. Only the prompt and the answer
travel.

The pattern in all four: put each step where its data should be and where its
work can happen, and let the board carry the results between them.

A consequence worth saying out loud: a board is portable in the sense that the
document is complete and the same JSON opens anywhere — but "anywhere" means
anywhere the runtimes it names can be reached. **A board built against a machine
on your desk is a board about your desk.** When one that worked yesterday will
not open, the runtime URL is the first thing to check.

---

## Where a runtime comes from

A board names runtimes; something has to be there to be named.

### The browser runtime: nothing to run

It is the tab. Adding one to a board takes no credentials, no address and no
server, which is why it is the one a board starts with and the one every example
assumes. A board may hold several; they run independently and share nothing, the
same isolation any two runtimes have.

What it does need is **permission**, for the services that reach hardware. A
camera or microphone service triggers the browser's own permission prompt the
first time it starts; denied, the service reports the failure in its panel and
recovers when the permission is granted and the page reloaded — the rest of the
board is untouched, because a permission belongs to the service asking, not to
the board. In the packaged desktop app the same permissions are declared in the
application bundle and granted once by the operating system.

### The servers

| Runtime | Started by | Listens on |
|---|---|---|
| hkp-node | `npx hkp-node`, a global install, or `docker run -p 8080:8080 cbastuck/hkp-node` | `PORT`, default 8080 |
| hkp-python | `hkp-python` from its virtualenv | `PORT`, default 8080 |
| hkp-rt | embedded in the Readymade app — it is already running when the app is | the app's `runtimePort`, off unless external access is enabled |

hkp-node and hkp-python take the same environment, because they answer the same
API: `PORT`, `HOST` (default `0.0.0.0`), `ALLOWED_ORIGINS`, and `EXTERNAL_HOST`.

`EXTERNAL_HOST` is the one worth understanding, because it is not the address the
server binds — it is the address the server *writes into what it hands back*: the
`outputUrl` a client is told to open its socket on, and the mount addresses it
publishes. It defaults to `127.0.0.1`, which is right until something on another
machine has to reach it, and then a runtime that binds every interface still
hands out an address only the host can dial. That is what makes a runtime look
provisioned and unreachable at once, and setting it to the LAN address is the fix.

### Adding one to a board

In the app: the runtimes menu, **add an external runtime**, a name and a host URL
(`http://localhost:8080`). The name is yours; the URL is what is dialled.

A saved server and the board are deliberately separate things. The list of
servers is the host's — kept by whoever is running the app, edited and deleted
there — while the board carries the runtime's own descriptor, URL included. So
removing a saved server does not break boards that used it: they still hold the
address and reconnect on their own.

`hkp://remotes/<name>` is the other way in, and it means something narrower than
it looks: it addresses the runtime **the app itself hosts**, under the name that
app runs as — every other remote is listed with its real URL. A name that is not
the app's own therefore names nothing and is refused, rather than being quietly
answered by whichever runtime happens to be embedded
(`meander/backend/remoteRoute.h`). A board pinned to a runtime that is
not running should fail visibly, not run somewhere else.

---

## The chain

Runtimes run **in board order**: the output of one is the input of the next.

```
runtimes[0]  →  runtimes[1]  →  runtimes[2]
```

The step between two runtimes is `onRuntimeResult()` in
`hkp-frontend/src/views/playground/Board/index.tsx`: when a runtime finishes, it
finds the next runtime in the array and calls its `processRuntime()`. Two things
about that step are worth knowing:

- **`null` stops the board.** The chain only continues `if (result !== null)`.
  The same value that stops a pipeline inside a runtime also stops the chain
  between them.
- **The board is driven from the first runtime.** The `playBoard` action calls
  `processRuntime` on `runtimes[0]`; everything after that is the chain. A
  service can also emit on its own (a Timer, an HTTP request arriving), which
  starts the chain from wherever that service sits.

For a deployed board the same chaining is done by the coordinator
(`routeResult()` / `nextRuntime()` in `hkp-node/src/coordinator/session.ts`),
including the case where the next runtime is a browser runtime it must reach
over the bridge.

---

## What crosses a runtime boundary

Because a runtime is a physical place, it is worth being precise about what
actually leaves one.

In normal operation:

| What crosses | When |
|---|---|
| **The result** a runtime hands to the next | every pass — this is the flow the board describes |
| **Configuration**, and the state a service reports back | whenever a service is configured or reports; the coordinator keeps the last state of every service, which is how whole-board questions are answered |
| **Log entries** | only while the board has logging switched on — see `concepts/logging.md` |

Everything else — the intermediate values passing between the services inside
one runtime — stays there. A runtime is a box that can be closed.

**With one exception, and it is the useful one.** Attach a UI to a runtime and
it starts reporting what each of its services is doing: not only what each
produced, but the input each was handed. That is what makes the panels live
(`onServiceProcess` sends `{__internal: {state: "call-process", data}}` before
every call, `onServiceResult` after it), and it is exactly what is wanted while
building.

It also means that while something is attached, a runtime's internal traffic is
leaving it. When nothing is attached, nothing is sent — this is not a filter
applied afterwards: the browser drops a notification with no target
(`hasCallbacks`), and a runtime server returns early when its socket set is
empty (`sendJsonNotification`). So it is a property that can be planned around:
keep a sensitive stage in a runtime nothing is attached to, and its intermediate
data stays put.

The caveat is deployment. **A deployed board's coordinator holds its own socket
to every runtime it provisioned**, because that is how it stays in touch with
them — so on a deployed board, assume there is always a listener. A step whose
intermediate data must not leave its machine belongs on a board you own
yourself.

---

## Inside a runtime: the pipeline

Each runtime owns an **ordered list of services**, and that order is the wiring.
The browser's loop (`BrowserRuntimeScope.next()`) is the shortest illustration of
the contract every runtime implements:

```ts
for (let i = position + 1; !!services[i] && result !== null; ++i) {
  svc = services[i];
  if (svc && !svc.bypass) {
    result = await svc.process(params);
    params = result;
  }
}
```

Three things fall out of those five lines: services run in order, a **bypassed**
service is skipped rather than removed, and `null` ends the pass. `next()` also
takes a *starting* service — which is what makes the pull and early-return
patterns below possible.

### Control flow

Four mechanisms, and they are not all implemented everywhere:

| Mechanism | How | Runtimes |
|---|---|---|
| **Stop** | return `null` — nothing downstream, and nothing in the next runtime, runs | all |
| **Early return** | return a `ControlFlowData` / `makeEarlyReturn` — skip the rest of this pipeline but carry a result out | hkp-rt, hkp-python |
| **Inversion of control (pull)** | return `null`, then drive the services after you yourself and act on their result | all (`app.next`, `host.processFrom`, `next()` / `nextAsync()`) |
| **Deferred / multi-emit** | answer later: `deferCompletion()` returns Null and suppresses the finish event, a later `emit()` delivers the real result | hkp-rt (`emitResult` in node) |

hkp-node and the browser break on `null`/`undefined` only — do not write a board
that relies on early return there. The loops to read are
`hkp-rt/lib/src/runtime.cpp` (`processFrom`), `hkp-node/src/runtime.ts`
(`processFromIndex`), `hkp-python/src/hkp/runtime.py`, and
`BrowserRuntimeScope.next`.

The canonical use of pull is a cache: on a **hit** it early-returns the cached
value; on a **miss** it stops the push, lets the services behind it fetch, keeps
what they produced, and emits that.

---

## Leaving the line

The chain and the pipeline are the default shape, not the only one. A service can
reach a *named* service or runtime and act on it directly:

| Mechanism | What it does | Where |
|---|---|---|
| `app.getServiceById(uuid)` | the live instance of another service in this runtime | `AppImpl` |
| `app.configureService` / `configureServiceInRuntime(runtimeId, uuid, config)` | reconfigure a service here or on another runtime | `AppImpl` |
| `app.processRuntimeByName(name, params)` | run a whole runtime by its name, out of order | `AppImpl` |
| `app.next(svc, result)` | emit as if `svc` had just produced this — the services after it run, it does not | `AppImpl` |
| **Configurator** service | calls `configure()` on `targetServiceUuid` (+ optional `targetRuntime`), then stops by default | `services/Configurator.ts` |
| **Process Router** service | calls `process()` on `targetServiceUuid` — feedback loops, state machines | `services/ProcessRouter.ts` |

These exist because some things genuinely are not a line: a value that has to go
back to an earlier stage, a panel that reconfigures something elsewhere on the
board, a state machine that picks its own next step.

**They are `goto`, and they cost what `goto` costs.** Two parts of the board now
know about each other, neither can be moved or reused alone, and the ordered list
no longer tells you what runs. Every such reference is also a field the generic
machinery must know by name — `targetServiceUuid`, `targetRuntime` and friends
are in `KNOWN_REFERENCE_FIELDS` (`core/forkBoard.ts`) precisely so a fork can
rewrite them; anything a service invents for itself is not carried across.

So: use them when the shape really is a cycle, and reach for **nesting** first
everywhere else. A nested pipeline is a step in the outer one — the host knows
its pipeline, the pipeline knows nothing of its host — and that ignorance is what
makes the group movable and readable. `join` is the pattern to imitate: a nested
pipeline whose result is merged *beside* the input, so a value can be computed
where it is needed instead of fetched from somewhere that has to be named.

---

## How the browser talks to a runtime

Three abstractions, all in `hkp-frontend/src/types.ts`:

| | What it is |
|---|---|
| `RuntimeApi` | the verbs, per runtime *type*: `addRuntime`, `restoreRuntime`, `processRuntime`, `addService`, `configureService`, `getServiceConfig`, `rearrangeServices`, … |
| `RuntimeScope` | one *live* runtime: its descriptor, its registry, `onResult`, and how to close it |
| `AppImpl` | what a **service** may do — `notify`, `next`, `log`, `createSubService`, `coordinator`, … |

There is one `RuntimeApi` implementation per runtime type
(`runtime/browser/BrowserRuntimeApi.ts`, `runtime/rest/RuntimeRestApi.ts`,
`runtime/graphql/…`), and the board picks the one matching `runtime.type`. This
is the seam that lets a cloud board swap in a REST api that talks over the
coordinator's bridge instead of dialling the runtime
(`views/cloud/bridgeRuntimeApi.ts`) without anything else noticing.

Runtime types carry two deprecated aliases — `realtime` → `rest` and `remote` →
`graphql` — normalised by `toCanonicalRuntimeClassType()`. Boards in the wild
still use them, so always compare canonical forms.

---

## Provisioning: `GET` attaches, `POST` provisions

For a remote runtime, `restoreRuntime()` in `runtime/rest/RuntimeRestApi.ts`:

1. `attachRuntime()` — `GET /runtimes`, find this id, and compare **service
   identity only** (uuid + serviceId, in order — never state, which legitimately
   drifts). Same board still running there? Attach to it, and re-push secrets,
   because a runtime that restarted still has its services and no longer has
   their credentials.
2. Otherwise `POST /runtimes` and build it.

> The verb is the intent; no server infers it.

A `RuntimeRestScope` then opens **one WebSocket per runtime** to the `outputUrl`
the server returned. That socket carries results and notifications — and it is
also what keeps the runtime alive, because of the lifecycle flag below.

### Lifecycle is declared, never inferred

In the create payload, by whoever creates the runtime:

| `garbageCollected` | Meaning | Who sends it |
|---|---|---|
| `true` | reap when the last client socket closes | a browser — its runtimes should not outlive the tab |
| absent / `false` | persist until an explicit `DELETE` | a coordinator, a config file, a script |

The default is persist, and a runtime nobody ever connected to is never reaped:
cleanup happens when a client *goes away*. All three servers honour it, pinned by
`hkp-node/tests/runtime-lifecycle.test.ts`,
`hkp-python/tests/test_runtime_lifecycle.py`,
`hkp-rt/tests/runtime_lifecycle.test.cpp`.

---

## Multi-tenancy

A runtime server is shared. Runtimes are namespaced by the authenticated `sub`,
so two people loading the same board each get their own runtime rather than
fighting over one (`TenantRuntimes` in `hkp-node/src/runtime.ts`). Every route
resolves runtimes through one of those views, so a handler cannot reach another
tenant's runtime even by id.

This is also why a service that must be reachable from outside cannot bind a
port of its own — see `concepts/mounts.md`.

---

## What a runtime carries besides services

- **A registry**: what services this runtime can create. Sent back when the
  runtime is provisioned, and used to offer the right service list and pick the
  right UI panel (`ServiceRegistry` per runtime id).
- **State**: presentation and per-runtime settings, e.g. `color`,
  `wrapServices`, `minimized`, `logData` — `runtime.state` in the board.
- **A URL**, for remote runtimes. `hkp://remotes/<name>` addresses the app's own
  embedded runtime (above); `HKP_RUNTIME_HOST` is substituted at load for boards
  that cannot know the host when they are written.
- **Bundles**: optional plugin libraries a runtime loads (`bundles[]`).
- **Custom actions**: host-level buttons a runtime can offer.

---

## Sub-runtimes

Every runtime supports a `sub-service`: a service that owns an ordered pipeline
of its own and runs it as one step of the outer pipeline. That nested pipeline is
a full runtime pass with the same rules — which is what makes reusable
higher-level building blocks possible, and what `http-server-subservices` uses to
answer a request with a pipeline rather than a single service.

Implementations: `runtime/browser/services/BrowserSubService.tsx`,
`hkp-node/src/services/sub-service.ts`, `hkp-rt/lib/src/services/sub_service.h`
(+ `sub_runtime.cpp`).

---

## Rough index into the source

| Concern | Where |
|---|---|
| Types (`RuntimeDescriptor`, `RuntimeApi`, `RuntimeScope`, `AppImpl`) | `hkp-frontend/src/types.ts` |
| Runtime-to-runtime chain | `hkp-frontend/src/views/playground/Board/index.tsx` (`onRuntimeResult`) |
| Browser runtime | `hkp-frontend/src/runtime/browser/` (`BrowserRuntimeApi.ts`, `BrowserRuntimeScope.ts`, `BrowserRuntimeApp.ts`) |
| REST runtime client | `hkp-frontend/src/runtime/rest/` (`RuntimeRestApi.ts`, `RuntimeRestScope.ts`, `Message.ts`) |
| Board load / restore | `hkp-frontend/src/core/boardPersistence.ts` |
| Node runtime + tenancy | `hkp-node/src/runtime.ts` |
| Python runtime | `hkp-python/src/hkp/runtime.py` |
| C++ runtime + sub-runtime | `hkp-rt/lib/src/runtime.cpp`, `sub_runtime.cpp` |
| Chain for deployed boards | `hkp-node/src/coordinator/session.ts` (`routeResult`, `nextRuntime`) |

---

See also: **Board** (`concepts/board.md`), **Service** (`concepts/service.md`),
**Mounts** (`concepts/mounts.md`), **Units and compositions**
(`concepts/units.md`) — the runtime is the axis a unit is projected along.
