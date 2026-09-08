# Coordinator

The instance that owns a board — the only one that can see across all of its runtimes, and therefore the one that answers questions no single runtime can.

---

## The question it answers

A runtime knows its own services and nothing else. That is enough for almost
everything a board does, because a service's work is local: take the input, do
the thing, hand the result on.

Some questions are not local:

- *What address did that service on the other runtime publish?* — a mount is
  assigned when its runtime loads, so nobody can write it into a board.
- *This board is about to be exported to a phone that will not have these
  runtimes — what concrete addresses should its references become?*
- *What state does a service on another runtime currently report?*

Each of those needs a view of the **whole board**, and no runtime has one. The
role that does is the **coordinator**.

---

## Why it is easy to miss that there always is one

In the playground and in Readymade, one browser tab plays every role at once:
it renders the UI, it hosts the browser runtime, it provisions the remote
runtimes over REST, and it holds the board's engine state. Asking "who
coordinates this board?" in that setting sounds like a trick question — the
answer is "the same thing that does everything else".

That is precisely why the role has to be named. **Coordinating a board and
hosting a runtime are separate jobs**, and they come apart as soon as a board is
deployed:

| Board runs as | Coordinator | Hosts browser runtimes | Provisions remote runtimes |
|---|---|---|---|
| Playground / Readymade | the browser | the browser | the browser, over REST |
| Cloud board | hkp-node | a connected browser | hkp-node |

Both rows are the **same board**. What changes is who owns it. A board moves
from the first row to the second by being **deployed**, and from that moment the
browser is a viewer of something it no longer owns.

Making the role explicit is what lets the same service code work in both: a
service asks *the coordinator*, not *the browser*, and does not know or care
which one answered.

---

## The interface

Deliberately small — four methods, in `hkp-frontend/src/core/coordinator.ts`:

| Method | Answers |
|---|---|
| `getServiceState(runtimeId, serviceUuid)` | what a service last reported, from anywhere on the board |
| `resolveMountUrl(value)` | a `__hkpMount` value as an address — resolving a `hkp-mount://` reference, passing an address through |
| `resolveMount(value)` | the same, split into host / port / path / secure for a client that dials by parts |
| `resolveMountsInBoard(board)` | every reference in a board document replaced by the address it currently resolves to (used when exporting) |

`createBoardCoordinator(readState)` builds one. Its only argument is *where
board state comes from* — which is the whole reason the same implementation
serves two very different situations.

**Undefined is a normal answer.** A board restores its runtimes concurrently, so
a service asking early gets nothing back; callers retry rather than treating it
as failure.

---

## The implementations

### 1. The browser owns the board

`BoardProvider` creates one per provider lifetime and reads through a ref, so
everything holding it sees current state (`hkp-frontend/src/BoardContext.tsx`,
`localCoordinatorRef`). This is the playground, Readymade, and any board opened
from a file.

### 2. The browser is attached to someone else's board

`hkp-frontend/src/views/cloud/index.tsx` calls the *same* factory, but reads
from the coordinator's pushed snapshot instead of local state:

```ts
const boardCoordinator = createBoardCoordinator(() =>
  bridgeAccess.snapshot.asCoordinatorState(),
);
```

and passes it into `BoardProvider` as the `coordinator` prop. `BoardProvider`
prefers a coordinator it is given over the one it would make
(`coordinatorProp ?? localCoordinatorRef.current`), and the prop's doc comment is
the rule in one line: *omit it when this provider owns the board*.

So a facade widget or a service panel resolving a mount runs identical code in
both cases. What differs is whether the state behind it is this browser's or a
copy of hkp-node's.

### 3. hkp-node coordinates a deployed board

Server-side, and **not** the same type despite the shared name:

| | frontend | hkp-node |
|---|---|---|
| Name | `BoardCoordinator` (interface) | `BoardCoordinator` (class) |
| File | `hkp-frontend/src/core/coordinator.ts` | `hkp-node/src/coordinator/coordinator.ts` |
| Holds | a way to read board state | `userId → boardName → BoardSession` |
| Does | answers cross-runtime questions | owns boards: provisions, persists, serves, tears down |

The node class is the *role*, played by a server; the frontend interface is the
*capability*, handed to services and UI. A `BoardSession`
(`hkp-node/src/coordinator/session.ts`) is one board being coordinated, and it
is where the equivalent cross-runtime work happens —
`recordMountAddress()` and `publishMountAddresses()` do there what
`resolveMountUrl` does here.

---

## How a service reaches it

A runtime host may hand the coordinator to the services it hosts, as
`AppInstance.coordinator` (`hkp-frontend/src/types.ts`). `BrowserRuntimeApp`
exposes it as a **read-through getter**, not a captured value, because the host
assigns it after services are built:

```ts
get coordinator() {
  return scope.coordinator ?? undefined;
}
```

A host that cannot see the board leaves it unset, and callers treat that exactly
like a lookup that has not resolved yet. `PeerConnection.resolveActivePeerHost()`
is the reference consumer: it resolves at *connect* time, not at load time, and
retries.

**A service on a remote runtime cannot do this at all** — it sees its own
runtime and nothing else, and the coordinator may be on another machine. So the
coordinator pushes instead: `hkp-frontend/src/core/mountPublication.ts`
(`pendingMountConfigures()`) computes what each remote consumer still needs and
configures it with the plain address. hkp-node's session does the same for the
boards it owns.

---

## Ownership, which is what the role really is

**A board has exactly one owner, and the owner provisions its runtimes.** Most
bugs in this area are one side acting as though it owned something it did not.

Runtime lifecycle is declared by whoever creates the runtime, in the create
payload — never inferred from who is connected:

| `garbageCollected` | Meaning | Who sends it |
|---|---|---|
| `true` | reap when the last client socket closes | a browser — its runtimes should not outlive the tab |
| absent / `false` | persist until an explicit `DELETE` | a coordinator, a config file, a script |

Deploying is the handover, and **the order is the whole trick**
(`hkp-frontend/src/core/deploy.ts`): `handOverRuntimes()` runs *before* the
register request, because both sides use the board's own runtime ids. From the
moment the coordinator provisions, those runtimes are its own — and the browser's
unmount cleanup would otherwise `DELETE` a board that is now deployed. Pinned by
`core/tests/deploy.test.ts` and `core/tests/deploy-handover.test.tsx`.

That id collision is the mechanism, not a bug: hkp-node namespaces runtimes by
the authenticated `sub`, so the stable ids boards ship (`node`, `chat-node`) do
not collide between people — and *do* collide between a browser and a
coordinator acting for the same person, which is exactly how a deploy replaces
what the browser had.

---

## What a coordinating hkp-node holds

Per board, in `BoardSession`:

| Field | What it is |
|---|---|
| `provisioned` | the runtimes this session created, with their result-socket URLs |
| `sockets` | one WebSocket per remote runtime, carrying results and notifications |
| `sessionTokens` | per-runtime delegated tokens for calls that outlive the user's JWT |
| `mountAddresses` | what each service published, keyed `runtimeId/serviceUuid` |
| `serviceStates`, `registries` | the board as the coordinator knows it — what an attached browser renders |
| `bridges` | every browser currently watching, each with the runtime ids it hosts |
| `seq` | ordering, so a browser can tell it missed an update |

**It persists the board, not the run.** `hkp-node/src/coordinator/fileBoardStore.ts`
writes `userId`, `boardName`, `createdAt` and `config`, and nothing else:
provisioned runtimes, live state, registries, mount addresses, session tokens
and status each describe one run against processes that may not exist on load.
A restored board is therefore **stopped** — provisioning needs the user's JWT,
and at boot there is no user.

---

## The bridge

One WebSocket per attached browser, at `/coordinator/bridge`, set up in
`hkp-node/src/index.ts` and handed to `BoardSession.registerBrowserSocket()`.
Message shapes live in `hkp-node/src/coordinator/bridgeProtocol.ts`; the browser
half is `hkp-frontend/src/views/cloud/useCoordinatorBridge.ts` and
`coordinatorSnapshot.ts`.

| Direction | Message | Meaning |
|---|---|---|
| → browser | `snapshot` | the whole board at a `seq`: config, each runtime's registry, each service's state |
| → browser | `serviceState` | one service's state changed |
| → browser | `notification` | a service's output — *not* state; a Monitor's message never appears in `getState()` |
| → browser | `processRuntime` | run this data through a **browser** runtime the coordinator cannot host |
| → coordinator | `resync` | I reconnected or saw a gap — tell me the board again |
| → coordinator | `configureService` | configure a service on a runtime you own |
| → coordinator | `result-from-browser` | what that browser runtime produced, so the chain can continue |
| → coordinator | `log` | an entry from a browser runtime, which has no other route into the board's log |

Two consequences worth holding on to:

- **A cloud board with a browser runtime cannot run headless.** The coordinator
  routes results into it over a bridge, so that link of the chain stalls with no
  viewer attached (`routeResult()` / `nextRuntime()`).
- **Attaching is a read.** `views/cloud/bridgeRuntimeApi.ts` builds scopes that
  open no socket, because the bridge already carries every runtime's state and a
  cloud runtime may live where the browser has no route at all. Structural edits
  are refused: adding a service means owning the board.

---

## Coordinators are also runtime hosts

Coordinating and hosting are separate roles played by the *same process*: the
coordinator API is under `/coordinator`, the runtime API at the server root. So
a board can put runtimes on the host of a coordinator it already knows, which is
why coordinators show up among the available engines —
`coordinatorRuntimeEngine()` and `withCoordinatorEngines()` in
`hkp-frontend/src/common.tsx`, pinned by `src/tests/coordinator-runtime-engines.test.ts`.

Users configure coordinators as `{ name, url }` pairs kept in `localStorage`
under `hkp-coordinators` (`restoreCoordinators()` / `storeCoordinators()`).

---

## Rough index into the source

| Concern | Where |
|---|---|
| Interface + browser implementation | `hkp-frontend/src/core/coordinator.ts` |
| Owned-vs-given decision | `hkp-frontend/src/BoardContext.tsx`, `hkp-frontend/src/core/boardContextTypes.ts` (`coordinator?` prop) |
| Handing it to services | `hkp-frontend/src/types.ts` (`AppInstance.coordinator`), `runtime/browser/BrowserRuntimeApp.ts` |
| Pushing addresses to remote runtimes | `hkp-frontend/src/core/mountPublication.ts` |
| Deploying (handover) | `hkp-frontend/src/core/deploy.ts`, `components/Toolbar/DeployMenu.tsx` |
| Attached mode | `hkp-frontend/src/views/cloud/` — `index.tsx`, `useCoordinatorBridge.ts`, `coordinatorSnapshot.ts`, `bridgeRuntimeApi.ts` |
| Server-side role | `hkp-node/src/coordinator/coordinator.ts` (`BoardCoordinator`) |
| One board being coordinated | `hkp-node/src/coordinator/session.ts` (`BoardSession`) |
| HTTP API | `hkp-node/src/coordinator/router.ts` |
| Bridge socket | `hkp-node/src/index.ts`, `hkp-node/src/coordinator/bridgeProtocol.ts` |
| Persistence | `hkp-node/src/coordinator/boardStore.ts`, `fileBoardStore.ts` |
| SSRF guard on board-supplied URLs | `hkp-node/src/coordinator/urlGuard.ts` |
| Tests that pin the rules | `hkp-frontend/src/core/tests/coordinator-ownership.test.tsx`, `deploy-handover.test.tsx`; `hkp-node/tests/coordinator-*.test.ts`, `bridge-snapshot.test.ts` |

---

## Known gaps

- **Resuming is not built.** Registering a board always provisions; a coordinator
  never attaches to runtimes that are already running under those ids.
- **Two processes, one data directory** both restore every board and both believe
  they own them. There is no lock — keep a data directory to one coordinator.
- **Orphans after a restart.** Runtimes provisioned to persist outlive the
  coordinator that made them; nothing sweeps for them, and only re-registering
  the same ids replaces them.
- **An absent coordinator is indistinguishable from an unresolved lookup.** Both
  are "nothing yet", so a host that forgot to pass one looks like a slow board.

---

See also: **Mounts** (`concepts/mounts.md`) for the questions that need a
coordinator most, and **Cloud boards** (`concepts/cloud-boards.md`) for what
happens when the role moves to a server.
