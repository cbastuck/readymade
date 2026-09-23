# Scopes — SubService as a boundary

Design notes from 2026-09-20, arising from `hkp-frontend/boards/rss-demo-board.json`.
Nothing is built yet. The board has two independent flows in one runtime — reading
feeds, and keeping/publishing a reading list — separated by a `stopper` named
"End of the read". The stopper works, but it is a *convention*: it says "nothing
continues from here" and leaves the reader to infer that everything above it
belongs to one flow, and that everything below it is entered from somewhere else.

**The decision: no new service.** A scope is a `sub-service` with two new
capabilities. Rejected alternatives and why are at the bottom.

**Status legend:** ☐ not started · ◐ in progress · ☑ done · ✎ needs design

**Where it stands:** built and tested in **hkp-node**, the **frontend**,
**hkp-python**, **hkp-rt** and the **browser runtime**. `rss-demo-board.json` runs as two scopes with no
Stopper, end to end through a real runtime
(`hkp-node/tests/rss-board-feed.test.ts`). All four runtimes carry the same
contract, and the docs are written. `scope.slots` defaults to `"own"`, decided
2026-09-20.

Nothing in the plan is outstanding. What is deliberately **not** built is under
*Open* at the bottom: `scope.params`, and the `secrets` and `logging` members
the `scope` block is shaped for.

---

## What a scope is

A `sub-service` that (a) can decline to pass its result on, and (b) can hold
state its children share and nothing outside can see. A board that uses either
is a scope; one that uses neither is the SubService that exists today. If the
word should be visible in a board, it is a `serviceName` — `"serviceId":
"sub-service", "serviceName": "Scope"` — which costs nothing and is per-instance.

```json
{ "uuid": "read", "serviceId": "sub-service", "serviceName": "Reading the feeds",
  "stopPropagation": true,
  "scope": { "slots": "own" },
  "pipeline": [ … ] }
```

The RSS board becomes two of these where it has a stopper between two halves.
The second is entered by the facade addressing it, not by the chain reaching it.

---

## 1 — `stopPropagation`

A boolean on `sub-service`. **Default `false`; absent means `false`.** Every
board that exists says nothing about it and must keep passing results on.

Reported by `getState()` **unconditionally**, like the `bypass` beside it
(`sub-service.ts:190`). A saved board then states outright what each scope does
with its answer. (This is deliberately *not* the `hold.ts:75` convention of
omitting what is not in use — `stopPropagation: false` is verbose, never
misleading, and its neighbour is already reported always.)

- ☑ `stopPropagation` in `SubServiceState`, read in `configure` only when boolean
- ☑ `process()` returns `null` instead of the pipeline's result
- ☑ **`emitOutward()` returns early** — see *Two routes out* below
- ☑ `getState()` reports it beside `bypass`
- ☑ Iterator honours it too — it overrides `process`, so it would otherwise
  have reported the flag and gone on passing its results along
- ☑ Tests — `hkp-node/tests/stop-propagation.test.ts`, both routes closed, the
  `bypass`+`stop` corner, and a board that omits the field unchanged
- ☑ hkp-python — **one route, because only one exists there.** Python's
  SubService registers notification and log targets but never a *result*
  target, so a nested autonomous emitter's output has no way out of a
  sub-pipeline at all. Pre-existing, not introduced here; `emitOutward` is a
  hkp-node and browser mechanism. Noted rather than built.
- ☑ hkp-rt — **both routes, and the second one is verified now.** The bubble at
  `sub_runtime.cpp` (`shouldBubbleToParent && m_ownerInParent` →
  `m_parent.processFrom(*m_ownerInParent, …)`) is hkp-rt's `emitOutward`; a
  scope that stops closes it and answers Null. Tested both ways.

It composes with `bypass` without a nonsense cell:

| `bypass` | `stopPropagation` | |
| --- | --- | --- |
| — | — | pipeline runs, result continues (today's behaviour) |
| — | ☑ | pipeline runs, nothing continues |
| ☑ | — | pipeline skipped, input continues |
| ☑ | ☑ | pipeline skipped, nothing continues — i.e. a Stopper |

---

## 2 — `scope: { … }`

One block rather than flat sibling keys, because more members are expected.
**`slots` is the only member to implement now.**

```json
"scope": { "slots": "own" }     // "own" | "inherit" (default)
```

- ☑ `scope.slots` on SubService, `"own"` | `"inherit"`, read on each lookup so
  changing it needs no rebuild; the store is owned by the service rather than
  the nested runtime, so a pipeline edit does not drop what is held
- ☑ Reported always, as `scope: { slots: … }`
- ☑ Tests — `hkp-node/tests/scope-slots.test.ts`, both values, two copies of
  one scope kept apart, and a change taking effect without a rebuild
- ☑ hkp-python — `tests/test_scopes.py`
- ☑ hkp-rt — `tests/service_scopes.test.cpp`. **hkp-rt's SubRuntime inherited
  by default** (`m_slots ? *m_slots : m_parent.slots()`), like NestedPipeline
  and unlike hkp-node's SubService, so SubService there now lends its own
  store; Tracks and the endpoint own one apiece.
- ☑ **Browser runtime — slots ported** (decided 2026-09-20: port rather than
  reject). `runtime/slots.ts` holds the shared `SlotStore`;
  `BrowserRuntimeScope` owns one and delegates like the others;
  `AppImpl.slots()` is how a browser service reaches it, since a browser
  service has no host of its own and `this.app` is the whole of what it can
  ask. `BrowserSubService` lends its own store, or the runtime's on `inherit`.

**✎ The default is `"own"`, not `"inherit"` as planned — and this needs a
decision.** The plan assumed a SubService inherits the surrounding runtime's
slots today. It does not. `SubService` delegates scope (`setScope`) and secrets
(`applySecrets`) outward but never delegated slots, so its nested
`HostedRuntime` silently fell back to its own `ownSlots` (`runtime.ts:145`).
`NestedPipeline` delegates all four (`nested-pipeline.ts:271-274`), so the two
nesting paths have had **opposite** slot defaults since slots were added.

`"own"` was chosen as the default because it is what SubService already did,
so no existing board changes. But the two readings genuinely pull apart:

- **`inherit`**, per `nested-pipeline.ts`: *"a service that declared none does
  not silently isolate what is nested in it"* — a slot name means one thing on
  a runtime.
- **`own`**, per CLAUDE.md: a SubService is *"the primary mechanism for reusable
  higher-level building blocks"*, and a reusable block whose slot names leak
  into its surroundings collides with a second copy of itself.

**Decided 2026-09-20: `"own"`, in every container.** A scope is a reusable
block before it is a neighbour, and a block whose slot names leak into its
surroundings collides with a second copy of itself. Tracks and the
communication dispatcher now own a store the way an endpoint always has
(`http-server.ts:445`), so all four containers agree: one store per service,
shared by its own pipelines, private from outside. Nothing in any board relied
on the old behaviour — every slot in every board is inside an endpoint, which
already owned its store.

Foreseen members, **not to be built now**, recorded so the block is not
retrofitted:

| Member | What it would scope | Note |
| --- | --- | --- |
| `secrets` | which credentials children can resolve | nested pipelines currently see the whole vault (`nested-pipeline.ts:250-260`) |
| `logging` | log this scope's children and nothing else | `logSettings()` is runtime-wide; connects to TODO-DEBUGGING |
| `params` | `{{param.x}}` bound per scope | ✎ overlaps units — see *Open* |

---

## 3 — Addressing

**Not a member of `scope`.** The others are *outward* resolution — what a child
sees when it looks something up. Addressing is *inward* — what the outside can
reach. It is not a toggle; it should simply always work.

A service inside a scope is addressed by a dotted path, and `path` keeps meaning
the field within that service's state:

```json
{ "serviceUuid": "read.kept-articles", "path": "rows" }
```

**Separator is `.`, not `/`**, and this is forced rather than chosen: a service
address goes into a URL path segment at `hkp-node/src/server.ts:923`
(`/runtimes/:runtimeId/services/:instanceId`) and `:964` (`…/process`).
`read/kept-articles` would 404. This is the same constraint that already picked
`.` for `UNIT_SEPARATOR` (`units.ts:60-64`). No conflict with
`hkp-mount://<runtimeId>/<serviceUuid>`, whose own separator is `/`.

**Reading.** Nested notifications already reached the top with the child's
instanceId preserved (`sub-service.ts:332`). The one gap: an instanceId is
unique only *within* its pipeline, so a bare one is not an address.

- ☑ Each boundary prefixes its own uuid on the way out — `SubService.rebuild`
  and `NestedPipeline.rebuild`, both via `joinAddress`
- ☑ `findService` resolves a scoped address (`boardServices.ts`)
- ☑ `resolvePath` needed no change — it already splits on dots (`readValue.ts:11`)

**Writing.**

- ☑ `processService` resolves one the same way (`boardServices.ts`)
- ☑ `Runtime.getService` resolves a dotted address (`runtime.ts`) — flat map
  first, then walk; `configureService` goes through it
- ☑ `Runtime.processAt` enters a scope at one of its services, via
  `HostedService.processNested`
- ☑ Tests — `hkp-node/tests/scoped-address.test.ts` (read, configure, process
  and a notification, one and two levels deep) and
  `hkp-frontend/src/facade/tests/scopedAddress.test.ts`
- ☑ hkp-python — `src/hkp/address.py`, scoped `get_service` /
  `configure_service` / `process_at`, `find_nested`, `process_nested`, and
  prefixing in SubService and NestedPipeline. Two existing tests in
  `test_nested_notifications.py` changed contract, as in hkp-node.
- ☑ hkp-rt — `lib/src/address.h`, `Runtime::resolveService`, scoped
  `configureService` / `getServiceState` / `processAt`, and
  `Service::findNested` / `processNested` as virtuals defaulting to "nothing
  inside me". One existing test changed contract, as in the other two.
- ☑ Browser runtime — `BrowserSubService.findNested` / `processNested`, and
  the facade resolving a scoped address through the scope holding it. The
  nested-notification wrapper in `_buildScope` now carries an `address`
  alongside the service's own `uuid`, so it composes to any depth.

**Decided while building, differing from the plan above:**

*Nested descriptors do not reach the board, and do not need to.* The plan had
`listServices` carrying them up or the frontend reading `state.pipeline`. Both
would have taught the board every container's shape. Instead an address is
matched by its **root**: the root is listed, so it says which runtime to dial,
and the whole address is what gets dialled — the runtime walks the rest. The
wire format is unchanged. The cost is that a nested service's proxy carries no
seed state (`state: undefined`); what it reports arrives when it first speaks,
and every facade consumer already guards for that.

*`InstanceId.address`, beside `uuid`.* A panel drawn for a nested service knows
it by the name its own pipeline gives it and must *listen* for it under the
path through the services containing it. Folding both into `uuid` broke ten
nested-UI tests for a real reason — they are different jobs. `NotificationTargets`
now keys on `address ?? uuid`; `uuid` still means what the service is called
where it lives. Same split as `hkp-mount://` versus `__hkpMount`.

*`processNested` is answered by SubService only.* An endpoint's entries and a
Tracks branch are driven by the thing that owns them — a request arriving, a
fan-out — so entering one from outside would run half of an arrangement whose
other half never happened. They stay readable and configurable by address
without being enterable by one.

*Four existing tests changed contract.* `tests/sub-service.test.ts` and
`tests/hold.test.ts` asserted a nested service reports under its bare
instanceId. They now assert the scoped address, which is the new contract.

---

## 4 — Mounts inside a scope

Not in the original plan. Migrating the board found it: an `http-server` inside
a scope published **no address at all**, so a board could not put an endpoint
in one — and the reader board's whole second half ends in one.

A nested runtime has no server, and `mount()` was the one thing on `RuntimeHost`
that was never passed down; scope, secrets and now slots all were. Two things
made it more than one line:

- ☑ **A mount is claimed once, eagerly.** Secrets and slots are looked up on
  each use, so delegating them late still works. A service that failed to claim
  a mount has already given up, and the nested services are built *before* the
  pipeline has a host to delegate to — so a retry was needed:
  `HostedService.remount()`, answered by `http-server` and `peer-server`, and
  passed down by SubService.
- ☑ **The name a mount is derived from.** It falls back to the scoped address,
  so two copies of one scope do not derive the same address and take each
  other's callers. A board that named its mount keeps the name, and with it the
  address it published before being scoped — which is what lets an outside
  subscriber go on working across the migration.
- ☑ `getServiceState` in the coordinator resolves a scoped address, so a
  `hkp-mount://` reference can name a service inside a scope
- ☑ Tests — `hkp-node/tests/scope-mounts.test.ts`
- ☑ hkp-python — `tests/test_scopes.py`
- ☒ hkp-rt — **does not apply.** hkp-rt has no mount facility: its endpoints
  bind a port, and `mount.h` there is for *reading* a `hkp-mount://` reference
  a board carries, not for owning one. Nothing to delegate.

## Facts established while looking at this

**Two routes out of a sub-pipeline, not one.** `sub-service.ts:279-295`:
a nested service that emits *without being called* — a Timer tick, a deferred
result from a service that returned `null` and came back later — has its output
carried past the SubService into the services after it. That is exactly the
`rss` service: `rss.ts:230-236` returns `null` from `process` and pushes the
articles later. **Closing only the return value would do nothing for the RSS
board** — the articles would still leak. The browser forwards the same way via
`scope.onResult`. **hkp-python does not have this route at all**: its
SubService registers notification and log targets but never a result target, so
a nested autonomous emitter's output never leaves the sub-pipeline there. (An
earlier note here claimed `sub_service.py:175` was the equivalent — that line
is a comment about the notification callback, not a second route out.)

**The slot machinery is already general.** `SlotStore` is a two-method interface
with nothing HTTP about it (`types.ts:238`); `NestedPipeline.shareSlots`
(`nested-pipeline.ts:284`) hands a container's pipelines a private store; the
fallback is already lexical. `http-server-subservices` is the only thing that
claims one today (`http-server.ts:445`), by accident of being the first service
that needed it. Hold's own header names the gap: *"the service owning both
pipelines, or failing that the runtime."*

**SubService already scopes four things** — notifications, mounts
(`handDownMount` repoints only children that asked), secrets, and lifetime
(`destroy` reaps nested timers and sockets). Slots are the one scoped resource
it does not claim.

**The RSS board's second half is already entered by address.** The facade
processes `record-article` mid-list, and what runs is whatever happens to follow
it (`processFrom(startAfterUuid)`). With scopes it addresses the scope, and what
runs is exactly what is written inside it. The board stops depending on list
adjacency to mean "belongs to the same flow".

---

**`http-server` defaults to `bypass = true`** (`http-server.ts:399`), so an
endpoint that does not say `bypass: false` holds no address. Worth knowing
before concluding that mounts are broken.

## Per runtime

| | `sub-service` | slots | `hold` | Note |
| --- | --- | --- | --- | --- |
| hkp-node | `services/sub-service.ts` | ☑ | ☑ | reference implementation |
| hkp-python | `services/sub_service.py` | ☑ | ☑ | done; no result target, so one route |
| hkp-rt | `services/sub_service.h` | ☑ | ☑ | done; bubble verified as the 2nd route |
| Browser | `services/BrowserSubService.tsx` | ☑ | ☑ | `services/Hold.ts`, `runtime/slots.ts` |
| hkp-go | — | — | — | no sub-service; out of scope |

---

## Order of work

Addressing first, not last. Migrating the RSS board is the proof the design
works, but the board reads four services the facade would otherwise lose
(`feeds`, `record-article`, `kept-articles`, `feed-serve`), so it cannot migrate
until dotted addressing exists in the frontend *and* hkp-node.

1. ☑ Addressing, hkp-node + frontend, read and write
2. ☑ `stopPropagation`, hkp-node
3. ☑ `scope: { slots }`, hkp-node
4. ☑ Migrate `rss-demo-board.json` to two scopes — the real test
5. ☑ hkp-python · ☑ hkp-rt
6. ☑ Browser: slots ported, `hold` service added, addressing done
7. ☑ Docs — `docs/content/concepts/scopes.md` (new, and added to
   `READING_ORDER` in the website's DocumentationConcepts),
   `docs/content/services/sub-service.md` (new — the cross-runtime service had
   no page, only the browser variant), the two new fields and scoped addressing
   in `board-json.md`, the browser row and a "where its cells live" table in
   `services/hold.md`, and a pointer from `browser-sub-service.md`.
   `node scripts/vocabulary.mjs`: every reference resolves.

   ✎ **The vocabulary has no `scopes` entry** — and `presets` has none either.
   It is written by hand and never extended on anyone's initiative, so this is
   left for you to decide.

---

## Open — deliberately not decided

**`scope.params` vs units.** A scope that binds `{{param.x}}` for its children
would make the same pipeline instantiable twice in one runtime — two readers
over two databases, which the RSS board cannot express today because
`unit.params` is one value for the whole document (`units.ts:73`). That turns a
scope from a boundary into a *component*, and lands on top of units, which solve
instantiation at board granularity (`UnitEntry.params`, `units.ts:97`). Either
scopes are the runtime-level instance of the same idea, or the two will drift.
Not blocking any of the above.

**Browser slots.** Whether to port `SlotStore` + `hold` to the browser runtime,
or have `scope.slots: "own"` fail loudly there.

---

## Resolved, so it is not re-opened

**What names a scope's entries** — nothing does. A scope has one pipeline and
one entry, addressed by its uuid. `http-server-subservices`' named entries
(`onProcess` / `onRequest`, `http-server.ts:13-19`) stay its own special case:
they name *who is calling*, which only an endpoint has to distinguish.

**Why not Tracks.** Tracks is one call fanned out — *"Every track is given the
same input"* (`tracks.ts:26`), answers in declaration order, joined by a reduce.
A scope is many calls over time, arriving separately, sharing what they left
behind. Spatial vs temporal. Putting the RSS board's two halves in Tracks would
mean one trigger running both, gated by a flag inside — every refresh entering
the SQL half, every save re-fetching four feeds.

**Why not a new `scope` serviceId.** Identical mechanics would fork the
implementation across four runtimes and force board authors to choose between
two things that behave the same. It also collides with `RuntimeHost.scope()`,
which already means tenant + board (`types.ts:297-307`).

**Why `stopPropagation` and not `terminal` / `continues: false`.** It is already
this project's phrase — CLAUDE.md's data-flow section is headed *"Stopping
propagation"*, and Stopper's header says *"nothing is forwarded"*. The DOM echo
(`Event.stopPropagation`) points the right way too: `emitOutward` is literally
the outward route.
