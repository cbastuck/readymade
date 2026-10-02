# Cloud boards

A board whose owner is a coordinator rather than a browser tab — provisioned once, kept running with nobody watching, and attached to when someone wants to look.

---

## The problem

A board built in the playground lives in the tab that built it. That browser
provisions the runtimes, so it asks for them with `garbageCollected: true` —
reap them when my socket closes — because runtimes that outlived the tab that
made them would pile up on a server with nothing to clean them.

That is right for building, and wrong for everything a board is *for* once it
works. A board that receives webhooks, answers a chat, or ticks on a timer has
to keep running when the person who built it closes their laptop.

A **cloud board** is that board, still the same board, with a different owner.

---

## Not a different kind of board

There is no cloud-board format, no separate schema, no flag in the JSON. The
same document runs either way; what differs is who provisions its runtimes:

| Board runs as | Owner | Its runtimes | The browser's role |
|---|---|---|---|
| Playground / Readymade | this browser | provisioned by it, over REST | owner |
| Deployed | a coordinator | built by it over connections their runtime servers opened, kept alive with nobody watching | viewer, over the bridge |

Moving between them is **deploying**. See the **Coordinator** concept
(`concepts/coordinator.md`) for the role itself; this page is what happens when
it moves to a server.

---

## Deploying, in order

The order is the whole trick, on both sides. Everything that can fail is done
while the browser still owns the board.

> **Warning — unit assets are not deployed:** Deployment carries only the
> top-level board's assets. A runtime contributed by a unit receives none of
> that unit's assets, so its `hkp-asset://…` references will fail to resolve.
> See [Assets: Units and deploying](./assets.md#units-and-deploying).

### Browser side — `hkp-frontend/src/core/deploy.ts`

The rocket in the toolbar opens `DeployDialog` (desktop) or `DeployBoardSheet`
(mobile); deploying calls `deployBoard()`, which:

1. serializes the board,
2. runs the **preflight** — below — and stops here if a runtime would not come
   up,
3. makes the **introduction**: asks the coordinator for a ticket per remote
   runtime and tells each runtime's server to connect to the coordinator with
   it — and stops here if one cannot,
4. calls `handOverRuntimes()` — **before** registering,
5. `POST /coordinator/users/<sub>/boards`, and reports what came back: a board
   the coordinator took but could not fully start is said to be exactly that,
   not "running".

Step 4 comes before step 5 because both sides use the board's own runtime ids.
From the moment the coordinator builds them, those runtimes are its own, and
this browser's unmount cleanup would otherwise `DELETE` a board that is now
deployed. Reversed, a navigation landing in between deletes what was just
deployed. Pinned by `core/tests/deploy.test.ts` and
`core/tests/deploy-handover.test.tsx`.

### Preflight — `hkp-frontend/src/core/deployPreflight.ts`

Past the handover a problem can only be reported, not avoided. So everything
knowable beforehand is asked beforehand, from the browser — the one party that
knows this person's runtime servers and can reach them — and answered **per
runtime**. It is also where a board's `remote` becomes an address
(→ `concepts/remotes.md`); the coordinator is told none.

| Finding | Meaning | Stops the deploy |
|---|---|---|
| `ready` | its server is running, accepted this person, has every service the board uses there, and can connect to a coordinator | |
| `transient` | a browser runtime — run by whichever browser has the board open | |
| `invalid` | it says where it runs more than once (`url` *and* `remote`, say) | yes |
| `unresolved` | the remote it names is not one this client knows | yes |
| `unreachable` | its server did not answer | yes |
| `refused` | its server answered `401`/`403` | yes |
| `missing-services` | its server's registry lacks services the board uses, which are listed | yes |
| `cannot-join` | its server cannot connect to a coordinator (the phone apps' embedded runtime, or a server that predates links) | yes |
| `unsupported` | a kind of runtime a coordinator does not run (GraphQL) | |

Every server answer comes from one `GET <server>/runtimes`, which already
returns the server's kind, registry and whether it can join. Only a runtime's
own pipeline is compared; what a service nests in its state is not walked. The
desktop dialog shows each finding before anything is handed over, names the
remote a name resolved to, and offers **Check again**; the
mobile sheet reports what stopped a deploy as a toast.

### The introduction

A coordinator never dials a runtime server — each one connects to it
(→ `concepts/remotes.md`). The browser is the only party with a session on both
sides, so it introduces them: a **ticket** from the coordinator
(`POST …/boards/<board>/tickets`), handed to the runtime server
(`POST <server>/coordinator-links`) together with the values for the secret
references that runtime's services hold. The runtime server connects to
`/coordinator/join` with the ticket and keeps it to reconnect with.

### Coordinator side — `hkp-node/src/coordinator/`

1. **Auth**, then `requireSelf`: the `:username` in the path must equal the
   token's `sub` (`coordinator/auth.ts`). In no-auth dev mode the path param is
   taken *as* the subject — only reachable in a checkout that set
   `ALLOW_NO_AUTH`.
2. **`BoardCoordinator.registerBoard()`** — serialized per `(user, board)`
   through a promise map, so two registrations cannot interleave: registering
   replaces a board's session, and replacing it destroys the old one, which
   releases the runtimes it had built. It lifts connected browser bridges out of
   the old session (`takeBridges()`), awaits `destroy()`, revokes the tickets of
   any runtime the board no longer has, starts a new `BoardSession`, and
   re-attaches the bridges — so a watching browser sees no disconnect.
3. **Per remote runtime — `BoardSession.bringUp()`**, over the connection its
   runtime server opened (`coordinator/participantProtocol.ts`):
   - `provision` — the runtime is built from the board's description of it, as
     the user who introduced the link, with `garbageCollected: false`. It
     replaces anything under that id, which is what makes a deploy safe: the
     browser's dying socket cannot reap the coordinator's fresh runtime.
   - the runtime's results, notifications and log entries arrive on the same
     connection from then on, and the coordinator drives the runtime over it.
   - a runtime whose server is **not connected** is not waited for. The board
     says which one is missing and builds it when that server connects.
4. **Mounts, once every runtime exists** — the addresses each runtime's
   services published in `__hkpMount` are recorded as it is built;
   `publishMountAddresses()` configures the consumers. A second pass, because a
   service can point at a mount on a runtime built later. The board keeps its
   `hkp-mount://` references: an address is only true of one run.

### Why tickets, and not the user's token

The coordinator's dealings with a runtime — driving it, configuring a service
an hour later, rebuilding it after its server restarted — must keep working
after the user's id token expires, and with nobody present. A ticket is **the
user's permissions for one runtime, delegated to a machine**: it resolves to
their `sub` on the runtime server, so there is no service superuser, and it
speaks for nothing but that runtime of that board. Because the runtime server
keeps it, a restart on either side is recovered from without the user.

---

## Attached: what a viewer may do

Opening a deployed board attaches to it. `views/cloud/bridgeRuntimeApi.ts`
builds runtime scopes that **open no socket** — the one bridge socket already
carries every runtime's state, and a cloud runtime may live where the browser
has no route to it at all.

| | How |
|---|---|
| Reads | from the coordinator's snapshot (`coordinatorSnapshot.ts`) — config, each runtime's registry, each service's live state |
| Configure | a request over the bridge; the coordinator makes the call |
| Notifications | their own bridge message. They are **not** state — a Monitor's output is deliberately absent from `getState()`, so a browser rendering state alone would show an empty Monitor on a running board |
| Structural edits | refused. Adding a service means owning the board |

Leaving the view closes the bridge scopes; it does not delete runtimes. A
deployed board keeps running.

Editing a deployed board means editing it in a playground and deploying again —
or forking it, below.

### Browser runtimes in a cloud board

A coordinator cannot host a browser runtime, so it routes results into one over
the bridge (`routeResult()` → `processRuntime` → `result-from-browser`). A
browser is a **transient** participant: with no viewer attached, data arriving
for that runtime stops there — as it would at a service that returned `null` —
and the board stays `running`. The consequence is worth stating plainly: **the
part of a cloud board downstream of a browser runtime does not run headless.**

### Bytes between runtimes

Both of a coordinator's connections — the link to a runtime server and the
bridge to a browser — carry JSON as text frames. A value that holds bytes
would not survive that: as text, a byte array arrives as an object of numbered
keys. So what one runtime hands the next travels as a **binary frame** when it
is not JSON:

```
[ 4 bytes: header length, big-endian ][ header: UTF-8 JSON ][ payload ]
```

The header is the message that would have been sent as text —
`{ "type": "result" }`, `{ "type": "processRuntime", … }` — with the value left
out and a `binary` field saying what the payload is:

| `binary.kind` | Payload | Also in the header |
|---|---|---|
| `bytes` | the value | — |
| `floatRingBuffer` | little-endian float32 samples | `id`, `ts` |
| `mixed` | the bytes of an object's `binary` field | `json`: the rest of the object |

`mixed` is what an HTTP response or a file read is on every runtime: bytes with
something said about them.

**The coordinator does not read the payload.** It parses the header, keeps the
bytes as they came, and writes them out under the next runtime's header. It
cannot corrupt what it does not interpret, and a new shape is a change to the
runtimes that produce and consume it, not to the coordinator.

Each runtime maps the shapes onto its own types. hkp-node has no ring buffer,
so one passing through it is held as
`{ type: "FloatRingBuffer", id, ts, binary }` and leaves as a ring buffer again
if nothing touched it.

Only a runtime's output and the next runtime's input travel this way. A
notification or a log entry that mentions bytes describes them — a size, a
type — because those are for a person to read.

**No ceiling is built in.** What a board passes between runtimes in the
playground it may pass when deployed. A coordinator's operator may set one —
`HKP_COORDINATOR_MAX_FRAME_BYTES` — because a coordinator is shared and holds a
frame once per attached viewer. A frame over it is dropped and recorded in the
board's log as `frame-dropped`; the connection, and the board, stay up.

This is not YAS, which is what a runtime server and a browser speak when the
browser drives the runtime itself. The link already has
a JSON header to say what the bytes are, and YAS has no encoding for `mixed`.

---

## Running, stopped, error

| Status | Meaning |
|---|---|
| `running` | every runtime the board cannot run without is built, on a runtime server that is connected |
| `stopped` | the coordinator still holds the **board** — its place in the list, its config, its tickets — but not its runtimes |
| `error` | a required runtime's server is not connected, or the runtime could not be built; `errors[]` names it |

**`error` is not terminal.** It is what a board is while a runtime server is
away, and it ends when that server reconnects: the runtime is picked back up if
it is still running there, and rebuilt from the board's config if it is not. An
attached browser is told as it happens — status and reasons travel together in
the bridge snapshot. A browser runtime with nobody attached is **not** an error
(→ *required and transient*, `concepts/remotes.md`).

**Stopping is not deleting.** `BoardSession.stop()` releases the runtimes and
clears everything that described that run — mount addresses, service states,
registries — while the board keeps its config. That is what editing does: the
browser takes the runtimes over, so the coordinator must not still hold them,
but a board being edited must not be a board that can be lost. The runtime
servers stay connected, so **Start needs no new tickets**.

Residue is reported rather than swallowed: a runtime that could not be released
— its server was not connected — is very likely still running, so those are
collected into `errors[]` while the status stays `stopped`. It is released when
that server next connects.

**Starting a stopped board is registering its config again** — there is no
separate start path.

---

## Persistence, and what deliberately is not persisted

Enabled with `COORDINATOR_ENABLED=true`. Boards are one JSON file each under
`HKP_COORDINATOR_DATA_DIR` (default `~/.hkp/coordinator/boards`); setting that
to the empty string keeps them in memory instead.

It persists `userId`, `boardName`, `createdAt`, `config`, whether the board was
**stopped**, and the **hashes of its tickets** — the board, not the run. Built
runtimes, live service state, registries, mount addresses and status each
describe one run against processes that may not exist on load, so writing them
down would persist claims that are false when read back.

- **Paths are hashed**, never built from names:
  `<sha256(userId)>/<sha256(boardName)>.json`. Both names come off the wire, so a
  board called `../../etc/passwd` must not escape the root — and `Foo` and `foo`,
  two boards to the coordinator, must not become one file on a case-insensitive
  filesystem. Real names live inside.
- **Writes are temp-then-rename**, so a crash leaves the previous board intact.
  Files are `0600`, directories `0700`: a board config carries service state,
  which can carry credentials.
- **Only ticket hashes are stored.** What is on disk recognises a ticket and
  cannot present one.
- **A restored board runs again by itself.** One that was running comes back in
  `error`, naming every runtime it is waiting for, and builds each as its
  runtime server reconnects with the ticket it kept. One that was stopped stays
  stopped. A file written before tickets existed comes back stopped — nothing
  holds a ticket for it, so nothing could reconnect.
- **A corrupt or newer-format file is skipped and logged**, never fatal.
- **A failing save does not fail a deploy**: the board runs, and only its
  survival of a restart is in doubt.

### While the coordinator is away

Runtimes are built to persist, so they outlive the coordinator that built them:
a webhook arriving while it restarts is still answered. Their runtime servers
keep trying to reconnect, and when the coordinator is back the board's runtimes
are rebuilt from its config under the same ids — one runtime, not two — at the
mount addresses they had. `hkp-node/tests/coordinator-restart.test.ts` covers
this end to end, in both directions.

### One directory, one coordinator

Not enforced, and worth knowing: two coordinator processes pointed at the same
data directory both restore every board and both believe they own them, and
both would accept the same tickets. There is no lock.

---

## The board's log

A board's log spans every runtime it uses, and **that stitching is why the
coordinator keeps it** — a runtime could only ever answer for its own slice. One
JSONL file per board under `HKP_COORDINATOR_LOG_DIR` (default: beside the
boards), size-bounded and rolled, with the board store's per-user owner-only
posture because entries carry board data (`coordinator/logStore.ts`).

- Entries from remote runtimes arrive on the connections their runtime servers
  opened.
- Entries from a browser runtime arrive over the bridge as `log` messages —
  that runtime has no other route into the board's log.
- Read back with `GET /coordinator/users/:username/boards/:boardName/runs`.
- The switch is `POST …/logging`; it is applied to the runtimes already running
  *and* written into the stored config, so it neither restarts anything nor
  quietly reverts on the next start. Runtimes that did not take it are reported
  rather than assumed.

Runs, entries, levels and what each runtime actually does: **Logging**
(`concepts/logging.md`).

---

## Getting back to an editor: fork

A deployed board is the coordinator's. The way back to something editable is to
**fork** it — "Fork board" in the start page's details column, for boards opened
from a coordinator. The host reads the config from the coordinator, copies it
with `hkp-frontend/src/core/forkBoard.ts`, saves it and opens it. Implemented in
both hosts (`meander/frontend/src/StartPage.tsx`, `hkp-website/src/pages/Start.tsx`).

**Every id is renamed, and everything naming an id is renamed with it** — a copy
that kept them would provision over the runtimes the original is running on, an
editor whose changes land on the deployed board:

| Kind | Where |
|---|---|
| Runtime ids | `runtimes[].id`, the keys of `services`, `targetRuntime`, `runtimeId` |
| Service ids | each service `uuid`, `instanceId` of nested services, `targetServiceUuid`, the facade's `serviceUuid` |
| Mounts | `__hkpMount`, when it holds a `hkp-mount://` reference |

Rewriting is driven by **field name, not by value**: an id like `node` or
`mon-1` is an ordinary string that can appear anywhere in a board.
`KNOWN_REFERENCE_FIELDS` is where a new such field is added. A `__hkpMount`
holding an *address* is left alone — it may name something outside the board
entirely.

Stopping the original and deploying the fork stays the user's call.

---

## Where a user meets all this

- **Deploy**: the rocket in the playground toolbar (`components/Toolbar/DeployMenu.tsx`),
  or "Deploy board" in the mobile board menu.
- **Find deployed boards**: the start page's **Cloud Boards** source — one
  folder per configured coordinator, its boards inside, labelled *Running in
  cloud* / *Stopped* / *Failed to start* (`views/start/useCloudBoardsFolder.ts`).
- **Open one**: the Cloud Boards view on desktop (`views/cloud/index.tsx`), the
  Cloud tab on mobile (`views/cloud/mobile/MobileCloudBoards.tsx`).
- **Coordinators themselves** are `{ name, url }` pairs in `localStorage` under
  `hkp-coordinators` (`hkp-frontend/src/common.tsx`), managed in the
  Manage-coordinators dialog. The same host also serves runtimes, so it appears
  in the add-runtime picker too.
- **Login is required.** Cloud boards are per user; the whole view is gated
  (`views/cloud/CloudLoginGate.tsx`).

Two different behaviours to know about here. The attached runtime scopes refuse
structural edits outright (`notWhileAttached` in `bridgeRuntimeApi.ts`) — adding
a service means owning the board. The **mobile** Cloud tab additionally watches
for structural change and re-registers the board when its runtimes or services
actually differ, so a change made there provisions rather than silently
diverging; the desktop view has explicit **Start** / **Stop** instead and
registers only when asked.

---

## When touching this area

- **Ownership before anything.** Ask who built the runtime you are about to
  change or delete. Runtime ids are the board's, so "it has the right id" is not
  evidence that it is yours.
- **Ids are per user, not global.** The stable ids boards ship (`node`,
  `chat-node`) do not collide between people — and *do* collide between a
  browser and a coordinator acting for the same person. That collision is the
  mechanism, not a bug.
- **The coordinator dials nothing.** If a change needs the coordinator to reach
  a runtime server, it needs an operation on the connection that server opened
  (`participantProtocol.ts`) — implemented on every runtime server that joins.
- **A missing participant is not one thing.** A remote runtime away is an
  error that names it; a browser runtime away is normal operation.
- **Reconnection is a real state**, on both kinds of connection. A dropped
  bridge re-snapshots; a runtime server that returns is picked up or rebuilt.
- **Mount references, not addresses, are what a board stores** — and names, not
  addresses, for its runtime servers. Resolving a mount belongs to the
  coordinator; resolving a remote belongs to the person's client.

---

## Rough index into the source

| Concern | Where |
|---|---|
| Deploy (browser side) | `hkp-frontend/src/core/deploy.ts`, `core/deployPreflight.ts`, `components/Toolbar/DeployMenu.tsx`, `DeployDialog.tsx`, `views/playground/mobile/DeployBoardSheet.tsx` |
| Naming a remote | `hkp-frontend/src/runtime/board/remote.ts` |
| Coordinator REST client | `hkp-frontend/src/views/cloud/coordinatorClient.ts` |
| Attached view | `hkp-frontend/src/views/cloud/index.tsx`, `useCoordinatorBridge.ts`, `coordinatorSnapshot.ts`, `bridgeRuntimeApi.ts` |
| Mobile | `hkp-frontend/src/views/cloud/mobile/MobileCloudBoards.tsx` |
| Finding boards | `hkp-frontend/src/views/start/useCloudBoardsFolder.ts` |
| Fork | `hkp-frontend/src/core/forkBoard.ts` |
| Coordinator role, sessions | `hkp-node/src/coordinator/coordinator.ts`, `session.ts` |
| HTTP API | `hkp-node/src/coordinator/router.ts` (`/coordinator/users/:username/boards…`) |
| Bridge socket | `hkp-node/src/index.ts` (`/coordinator/bridge`), `coordinator/bridgeProtocol.ts` |
| Board + log persistence | `hkp-node/src/coordinator/fileBoardStore.ts`, `logStore.ts` |
| Tickets, joining, the participant protocol | `hkp-node/src/coordinator/participants.ts`, `join.ts`, `participantProtocol.ts` |
| Bytes between runtimes | `hkp-node/src/coordinator/binaryFrame.ts`, `hkp-python/src/hkp/binary_frame.py`, `hkp-rt/lib/src/binary_frame.h`, `hkp-frontend/src/views/cloud/bridgeBinary.ts` |
| A runtime server's link to a coordinator | `hkp-node/src/coordinatorLinks.ts`, `hkp-python/src/hkp/coordinator_links.py`, `hkp-rt/lib/src/coordinator_links.cpp` |
| Tests | `hkp-node/tests/coordinator-*.test.ts`, `bridge-snapshot.test.ts`, `board-log.test.ts`; `hkp-python/tests/test_coordinator_links.py`; `hkp-frontend/src/views/cloud/tests/`, `core/tests/deploy*.test.*`; `e2e/tests/cloud/` |

---

## Known gaps

- **Unit-owned assets are not deployed.** Deployment carries only the
  top-level board's asset descriptors. A runtime contributed by a unit receives
  none of that unit's assets, so its `hkp-asset://…` references will not resolve
  in the deployed board. See [Assets: Units and deploying](./assets.md#units-and-deploying).
- **A phone's embedded runtime cannot join a coordinator**, by decision: the
  app is suspended at will. The preflight stops a board that places a runtime
  there.
- **Credentials do not survive a runtime server restart.** The ticket does; the
  values handed over with the introduction are held in memory. The board says
  which are missing, and deploying again supplies them.
- **No lock on the data directory** (see above).
- **The part of a board downstream of a browser runtime does not run headless.**
- **The mobile deploy sheet has no per-runtime dialog**, and the mobile cloud
  view reads a board's reasons from the listing rather than live.
- **Deploy is one-way per board**: the way back is a fork, which is a *copy* —
  the deployed board keeps running until someone stops it.

---

See also: **Coordinator** (`concepts/coordinator.md`), **Remotes**
(`concepts/remotes.md`), **Mounts** (`concepts/mounts.md`) and **Logging**
(`concepts/logging.md`).
`plans/TODO-CLOUD-COORDINATOR.md` records why it is built this way and what is
still open.
