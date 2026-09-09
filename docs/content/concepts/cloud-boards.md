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
| Deployed | a coordinator | provisioned by it, kept alive with nobody watching | viewer, over the bridge |

Moving between them is **deploying**. See the **Coordinator** concept
(`concepts/coordinator.md`) for the role itself; this page is what happens when
it moves to a server.

---

## Deploying, in order

The order is the whole trick, on both sides.

### Browser side — `hkp-frontend/src/core/deploy.ts`

`DeployMenu` (desktop) or `DeployBoardSheet` (mobile) calls `deployBoard()`,
which:

1. serializes the board,
2. calls `handOverRuntimes()` — **before** registering,
3. `POST /coordinator/users/<sub>/boards`.

Step 2 comes first because both sides use the board's own runtime ids. From the
moment the coordinator provisions, those runtimes are its own, and this
browser's unmount cleanup would otherwise `DELETE` a board that is now deployed.
Reversed, a navigation landing in between deletes what was just deployed. Pinned
by `core/tests/deploy.test.ts` and `core/tests/deploy-handover.test.tsx`.

### Coordinator side — `hkp-node/src/coordinator/`

1. **Auth**, then `requireSelf`: the `:username` in the path must equal the
   token's `sub` (`coordinator/auth.ts`). In no-auth dev mode the path param is
   taken *as* the subject — only reachable in a checkout that set
   `ALLOW_NO_AUTH`.
2. **`BoardCoordinator.registerBoard()`** — serialized per `(user, board)`
   through a promise map, so two registrations cannot interleave: registering
   replaces a board's session, and replacing it destroys the old one, which
   hands back the runtimes it had provisioned. It lifts connected browser
   bridges out of the old session (`takeBridges()`), awaits `destroy()`, starts
   a new `BoardSession`, and re-attaches the bridges — so a watching browser
   sees no disconnect.
3. **Per remote runtime — `BoardSession.provision()`:**
   - `assertRuntimeUrlAllowed(url)` — SSRF guard. Board configs are untrusted
     (shared, imported), so blocked targets are refused before any request
     leaves the process (`coordinator/urlGuard.ts`).
   - `POST /runtimes` with `garbageCollected: false`, authenticated with the
     **user's forwarded JWT**. Always a POST: registering a board is a deploy,
     so it creates-or-replaces.
   - `POST /runtimes/:id/session-token` with the same JWT — see below.
   - open the coordinator's **own** WebSocket to the returned `outputUrl`,
     authenticated with that session token, after validating the URL again in
     case a hostile target tried to redirect it somewhere blocked.
4. **Mounts, once every runtime exists** — `collectMountAddresses()` reads each
   runtime's services and records what they published in `__hkpMount`;
   `publishMountAddresses()` configures the consumers. Two passes, because a
   service can point at a mount on a runtime provisioned later. The board keeps
   its `hkp-mount://` references: an address is only true of one run.

### Why session tokens exist

The coordinator's long-lived calls — its result socket, teardown, configuring a
service an hour later — must keep working after the user's id token expires. The
session token is **the user's permissions, delegated**: the runtime server
returns an opaque random string bound to `{sub, runtimeId}` and resolves it back
to their `sub`, so there is no service superuser. It lives in that server's
memory only; if the process dies, the coordinator must re-provision, which needs
a live user JWT.

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
the bridge (`routeResult()` → `processRuntime` → `result-from-browser`). The
consequence is worth stating plainly: **a cloud board containing a browser
runtime cannot run headless.** That link of the chain stalls with no viewer
attached.

---

## Running, stopped, error

| Status | Meaning |
|---|---|
| `running` | the coordinator owns and holds this board's runtimes |
| `stopped` | the coordinator still holds the **board** — its place in the list, its config — but not its runtimes |
| `error` | something failed to come up; `errors[]` says what |

**Stopping is not deleting.** `BoardSession.stop()` tears the runtimes down and
clears everything that described that run — sockets, mount addresses, service
states, registries — while the board keeps its config. That is what editing
does: the browser takes the runtimes over, so the coordinator must not still
hold them, but a board being edited must not be a board that can be lost.

Residue is reported rather than swallowed: a runtime the coordinator could not
release is very likely still running, so those are collected into `errors[]`
while the status stays `stopped`. A `404` is not one of them — it means there is
no such runtime, which is what was asked for. The three runtime servers disagree
about saying so (hkp-node answers `200` whether or not it held one; hkp-python
and hkp-rt answer `404`), so anything treating every non-2xx as failure will cry
wolf on two of the three.

**Starting a stopped board is registering its config again** — there is no
separate start path.

---

## Persistence, and what deliberately is not persisted

Enabled with `COORDINATOR_ENABLED=true`. Boards are one JSON file each under
`HKP_COORDINATOR_DATA_DIR` (default `~/.hkp/coordinator/boards`); setting that
to the empty string keeps them in memory instead.

It persists `userId`, `boardName`, `createdAt` and `config` — **the board, not
the run**. Provisioned runtimes, live service state, registries, mount
addresses, session tokens and status each describe one run against processes
that may not exist on load, so writing them down would persist claims that are
false when read back.

- **Paths are hashed**, never built from names:
  `<sha256(userId)>/<sha256(boardName)>.json`. Both names come off the wire, so a
  board called `../../etc/passwd` must not escape the root — and `Foo` and `foo`,
  two boards to the coordinator, must not become one file on a case-insensitive
  filesystem. Real names live inside.
- **Writes are temp-then-rename**, so a crash leaves the previous board intact.
  Files are `0600`, directories `0700`: a board config carries service state,
  which can carry credentials.
- **A restored board is stopped**, and can be nothing else — provisioning and
  minting a session token both need the user's JWT, and at boot there is no user.
  Starting it is the owner's move.
- **A corrupt or newer-format file is skipped and logged**, never fatal.
- **A failing save does not fail a deploy**: the board runs, and only its
  survival of a restart is in doubt.

### The orphan window

Runtimes are provisioned to persist, so they outlive the coordinator that made
them. After a restart they are still running with nothing tracking them —
holding their mounts, keeping their state. Pressing **Start** re-registers the
same config under the same runtime ids, and `POST /runtimes` replaces, so the
orphan is destroyed and rebuilt. A board that is never started again keeps its
orphan; nothing sweeps for them. `hkp-node/tests/coordinator-restart.test.ts`
covers this end to end.

### One directory, one coordinator

Not enforced, and worth knowing: two coordinator processes pointed at the same
data directory both restore every board and both believe they own them. They
would provision the same runtime ids against the same runtime servers and
replace each other's runtimes, which looks like runtimes randomly restarting.
There is no lock.

---

## The board's log

A board's log spans every runtime it uses, and **that stitching is why the
coordinator keeps it** — a runtime could only ever answer for its own slice. One
JSONL file per board under `HKP_COORDINATOR_LOG_DIR` (default: beside the
boards), size-bounded and rolled, with the board store's per-user owner-only
posture because entries carry board data (`coordinator/logStore.ts`).

- Entries from remote runtimes arrive on their result sockets.
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

## Rough index into the source

| Concern | Where |
|---|---|
| Deploy (browser side) | `hkp-frontend/src/core/deploy.ts`, `components/Toolbar/DeployMenu.tsx`, `views/playground/mobile/DeployBoardSheet.tsx` |
| Coordinator REST client | `hkp-frontend/src/views/cloud/coordinatorClient.ts` |
| Attached view | `hkp-frontend/src/views/cloud/index.tsx`, `useCoordinatorBridge.ts`, `coordinatorSnapshot.ts`, `bridgeRuntimeApi.ts` |
| Mobile | `hkp-frontend/src/views/cloud/mobile/MobileCloudBoards.tsx` |
| Finding boards | `hkp-frontend/src/views/start/useCloudBoardsFolder.ts` |
| Fork | `hkp-frontend/src/core/forkBoard.ts` |
| Coordinator role, sessions | `hkp-node/src/coordinator/coordinator.ts`, `session.ts` |
| HTTP API | `hkp-node/src/coordinator/router.ts` (`/coordinator/users/:username/boards…`) |
| Bridge socket | `hkp-node/src/index.ts` (`/coordinator/bridge`), `coordinator/bridgeProtocol.ts` |
| Board + log persistence | `hkp-node/src/coordinator/fileBoardStore.ts`, `logStore.ts` |
| SSRF guard | `hkp-node/src/coordinator/urlGuard.ts` |
| Tests | `hkp-node/tests/coordinator-*.test.ts`, `bridge-snapshot.test.ts`, `board-log.test.ts`; `hkp-frontend/src/views/cloud/tests/`, `core/tests/deploy*.test.*` |

---

## Known gaps

- **Resuming is not built.** Registering always provisions; a coordinator never
  attaches to runtimes already running under those ids. Start on a stopped board
  is a re-deploy.
- **No lock on the data directory** (see above).
- **Orphaned runtimes** after a coordinator restart are only reclaimed by
  starting the board again.
- **A board with a browser runtime cannot run headless.**
- **Deploy is one-way per board**: the way back is a fork, which is a *copy* —
  the deployed board keeps running until someone stops it.

---

See also: **Coordinator** (`concepts/coordinator.md`), **Mounts**
(`concepts/mounts.md`) and **Logging** (`concepts/logging.md`). The working
reference with more operational detail is `CLOUD-BOARDS.md` at the repo root;
`TODO-CLOUD-COORDINATOR.md` records why it is built this way and what is still
open.
