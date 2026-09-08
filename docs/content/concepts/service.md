# Service

The unit of work: one thing a board does, with configuration you can see, a panel you can drive it from, and a place in an ordered list that is its wiring.

---

## The contract

A service takes input, does something, and returns output. Two methods carry
almost everything:

| Method | When it is called |
|---|---|
| `configure(config)` | on load, and whenever anything changes its settings — a user edit, a facade widget, the coordinator handing over a resolved address |
| `process(input)` | with the output of the service before it, or `undefined`/`Null` when nothing came before |

and one more that makes a board saveable:

| `getState()` / `getConfiguration()` | what this service was configured with — which is what gets written into the board |

In TypeScript that is `ServiceRuntimeContract` in `hkp-frontend/src/types.ts`; in
hkp-node it is `HostedService`; in C++ it is the `Service` base class
(`hkp-rt/lib/include/service.h`). The three are the same shape deliberately, so
the same concept can exist on more than one runtime.

**State is configuration, not output.** A Monitor's messages never appear in its
state: what it *shows* is a notification, what it *is* is its settings. That
distinction is why a browser attached to a deployed board receives notifications
as their own kind of message rather than reading them out of state.

---

## What a service may do

Beyond returning a value, a service reaches its host — `AppImpl` in the browser,
`RuntimeHost` in node, the `Service` base in C++:

| Capability | Browser | Meaning |
|---|---|---|
| Notify | `app.notify(this, payload)` | tell whoever is watching — panels, facade widgets. Dropped when nobody is |
| Log | `app.log(this, level, event, data)` | record something about the run. Survives with nobody attached, which is what an unwatched board needs |
| Emit / pull | `app.next(this, result)` | run the services *after* this one with this value, without re-running this one |
| Nest | `app.createSubService(...)` | own a pipeline of your own |
| Reach the board | `app.coordinator` | ask a question that spans runtimes — see `concepts/mounts.md` |
| Keep something | `app.storeServiceData` / `restoreServiceData` | small durable per-service values |

`notify` and `log` are the pair worth getting right: one is for a person looking
now, the other is for answering "what happened?" later.

---

## Modes

A service may have **modes** — named variants that change what `process` does
while staying one service. Modes are configuration, not separate services: they
are how a concept keeps its related behaviours together instead of splitting
into near-duplicates.

The design rule is in `CLAUDE.md`: *scoped by concept, not by technique*. Input
handles event streams and WebSockets — different technology, same idea, one
service. Complexity belongs in composition, not inside a service.

---

## Bypass

Every service can be bypassed. A bypassed service is **skipped in the pipeline**
but still there, still configured, still saved — the loop reads
`if (svc && !svc.bypass)`. For services that hold a resource (a server, a
socket, an audio device) bypass is also the on/off switch: hkp-rt's
`onBypassChanged` starts and stops the server behind the service.

---

## The panel

A service may ship a UI component (`createUI`). A service that ships none gets
`PlaceholderUI`, which renders its configuration as editable fields — so
**every** service has a panel, and nothing is a black box.

- For **browser** services the service and its panel share one JS process, so
  keeping them in sync is a direct method call.
- For **remote** services the panel talks over REST: configure, then read back
  `getState`. Optimistic UI is the norm — apply locally, send, reconcile.
- Panels are resolved by `serviceId` through the UI registry
  (`runtime/browser/UIRegistry.ts`, `runtime/rest/UIRegistry.ts`), falling back
  to the runtime's own registry entry, then to the placeholder.

---

## Identity: `serviceId` vs `uuid`

| | What it is |
|---|---|
| `serviceId` | *what kind* of service this is — `hookup.to/service/timer`, `http-client`, `monitor`. Chosen by the implementation, shared by every instance |
| `uuid` | *which instance* — unique within the board, and what everything else refers to: facade widgets, mount references, sub-pipeline entries |
| `serviceName` | the label a person sees; editable, and not an identifier |

Browser service ids are historically URL-shaped (`hookup.to/service/...`), while
the other runtimes use plain names (`http-client`). Where a service exists on
more than one runtime, the ids are being aligned so a board can move — see
`TODO-CONSOLIDATION.md`.

---

## State that isn't the service's own

Two prefixes in service state mean something the service did not decide:

- **`__hkp…`** — a property whose meaning is defined *outside* the service
  holding it. Generic board machinery reads and rewrites it. `__hkpMount` is the
  current example. The prefix is reserved: a service must not use such a name for
  anything else.
- **`{{secret.alias}}`** — a reference to a value the board never holds. It is
  never substituted into state, so `getState` reports the reference and saving
  writes back what was configured. The value exists only inside the call that
  uses it (`core/secrets.ts`).

Both exist for the same reason: a board is a document meant to be shared, and
neither an address that was true on one machine nor a credential belongs in it.

---

## Nesting

A `sub-service` holds an ordered pipeline of its own and runs it as one step of
the outer one. This is the primary mechanism for building reusable
higher-level blocks, and every runtime has it:
`runtime/browser/services/BrowserSubService.tsx`,
`hkp-node/src/services/sub-service.ts`, `hkp-rt/lib/src/services/sub_service.h`.

Nested services are configured through their host service rather than as
top-level entries — `pipeline`, `appendService`, `removeService`,
`configureService` in the host's own configuration — and they carry
`instanceId` rather than `uuid`, which forking rewrites too.

---

## Structured flow, not wires

There is no wire UI, and this is a decision rather than an omission. Explicit
wires are like `goto`: they work, and they make a flow hard to reason about. The
ordered service list *is* the flow, and branching is expressed with services:

- **Filter** stops propagation when a predicate fails.
- **Switch** pattern-matches and routes into sub-pipelines.
- **Looper** repeats sub-services until a predicate stops it.
- **Cache** early-returns on a hit, and on a miss pulls the services behind it.

The four control-flow mechanisms those rely on — stop, early return, pull,
deferred emit — and which runtimes implement each, are in
`concepts/runtime.md`.

### Nest; don't reach

A service *can* reach another one: `app.getServiceById(uuid)` hands over the live
instance, `configureServiceInRuntime` reconfigures one on another runtime, and
the **Configurator** and **Process Router** services exist to call `configure()`
or `process()` on a service named by `targetServiceUuid`. There are shapes that
need this — a feedback loop, a state machine, a panel driving something elsewhere.

But a service that names another service's id is a service that cannot be
reused, moved or read on its own, and the id it holds is one more field the
generic machinery has to know by name (`KNOWN_REFERENCE_FIELDS` in
`core/forkBoard.ts`, so a fork can rewrite it). Two modules that were supposed to
know nothing about each other now do.

**Design services that nest instead.** A service that owns a pipeline gets its
answer by *running* one, and the pipeline it runs knows nothing about it:

- `sub-service` — a pipeline as one step.
- `join` (hkp-node) — a pipeline as a **detour**: the result is merged *beside* the input
  rather than replacing it, so the carrier (which conversation, which record)
  survives. Two services that would otherwise have to find each other — one
  producing a value, one filing it where it belongs — become one grouped step
  that takes a value in and hands a bigger value out.
- `switch` — pipelines as branches; `looper` — a pipeline repeated;
  `http-server-subservices` — a pipeline as the handler for a request;
  `board-service` — an entire saved board as a step.

The test when writing a service: **does it need to know anything about the board
around it?** If the answer is a service uuid, there is usually a nesting that
computes the value where it is needed instead — and a service that takes input
and returns output composes with everything, while a service that names another
one composes with nothing.

---

## Adding one

Every runtime has a registry that says what it can create, and a service is only
finished when all of its pieces exist:

| Piece | Browser | hkp-node | hkp-rt |
|---|---|---|---|
| Implementation | `runtime/browser/services/base/*.ts` | `src/services/*.ts` | `lib/src/services/*.h` |
| Descriptor + factory | `runtime/browser/services/*.tsx` | `ServiceRegistryEntry` | `serviceId()` static |
| Registration | `runtime/browser/registry/Default.ts` | the service map in `src/server.ts` | `lib/src/registry.cpp` |
| Panel | `*UI.tsx` in the same folder | frontend `runtime/rest/ui/` | frontend `runtime/rest/ui/` |
| Docs + demo board | `docs/content/services/<slug>.md`, `hkp-frontend/boards/<slug>-demo-board.json` | same | same |

The scaffolding skills do this end to end: `/new-browser-service`,
`/new-node-service`, `/new-cpp-service`.

Every service file starts with a **Service Documentation** header block —
service id, name, modes, key config, IO, how it treats arrays, binary and
MixedData. It is the first thing to read, and the first thing to write.

---

## Rough index into the source

| Concern | Where |
|---|---|
| Contract types | `hkp-frontend/src/types.ts` (`ServiceRuntimeContract`, `ServiceInstance`, `ServiceModule`, `AppImpl`) |
| Browser service host | `hkp-frontend/src/runtime/browser/BrowserRuntimeApp.ts`, `BrowserRuntimeScope.ts` |
| Browser registry | `hkp-frontend/src/runtime/browser/BrowserRegistry.tsx`, `registry/Default.ts` |
| Panels | `hkp-frontend/src/runtime/browser/UIRegistry.ts`, `services/PlaceholderUI.tsx`, `ui-components/service/` |
| Node contract | `hkp-node/src/types.ts` (`HostedService`, `RuntimeHost`) |
| C++ base | `hkp-rt/lib/include/service.h`, `lib/src/service.cpp` |
| Data types across runtimes | `hkp-frontend/src/runtime/rest/Data.ts`, `hkp-rt/lib/include/types/data.h` |
| Secret references | `hkp-frontend/src/core/secrets.ts` |
| Per-service docs | `docs/content/services/*.md` |

---

See also: **Board** (`concepts/board.md`), **Runtime** (`concepts/runtime.md`),
**Mounts** (`concepts/mounts.md`).
