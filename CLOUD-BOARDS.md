# Cloud boards — how a board gets provisioned

A working reference for anything that touches board ownership, runtime
provisioning, or the coordinator. Read the two-owner rule first; most bugs in
this area are one side acting as though it owned something it did not.

Companion docs: `CLAUDE.md` (concepts), `TODO-CLOUD-COORDINATOR.md` (why it is
built this way, and what is still open).

---

## The rule everything follows

**A board has exactly one owner, and the owner provisions its runtimes.**

| Where the board is | Owner | Its runtimes | The browser's role |
| --- | --- | --- | --- |
| Playground / Readymade | this browser | provisioned by it, over REST | owner |
| Deployed | a coordinator | provisioned by it, kept alive with nobody watching | viewer, over the bridge |

The two are the same board with a different owner — not two kinds of board.
Moving between them is **deploying**, and there is no way back yet (see
"Not built").

---

## Building: the browser provisions

Adding a runtime (`RuntimeRestApi.addRuntime`) mints a **uuid** as the runtime
id and posts it. A board loaded from JSON keeps the ids the file carries, which
is what makes them stable across reloads — and what makes them collide on
purpose when the same board is deployed.

- `POST /runtimes` — id, name, services, `garbageCollected: true`, authenticated
  with the user's Auth0 id token.
- `POST /runtimes/:id/services` — adding a service later, same token.
- `RuntimeRestScope` opens **one WebSocket per runtime** to the returned
  `outputUrl`. That socket carries notifications *and* is what keeps the runtime
  alive — see lifecycle below.

Reloading the page does not rebuild what is already there:
`restoreRuntime` first calls `attachRuntime`, which does `GET /runtimes`, finds
the id, and compares **service identity only** (uuid + serviceId, in order —
never state, which legitimately drifts). Same board still running? Attach to it.
Otherwise `POST` and build it.

> `GET` attaches, `POST` provisions. The verb is the intent; no server infers it.

---

## Deploying: the coordinator takes over

`DeployMenu` → `core/deploy.ts` → `POST /coordinator/users/<sub>/boards`.

**Order matters, and it is the whole trick.** `handOverRuntimes()` is called
*before* the register request. Both sides use the board's runtime ids, so from
the moment the coordinator provisions, those runtimes are its own — and the
browser's unmount cleanup would otherwise `DELETE` a board that is now deployed.
Reversed, a navigation landing in between deletes what was just deployed.
Pinned by `core/tests/deploy.test.ts` and `core/tests/deploy-handover.test.tsx`.

### Coordinator side, in order

1. **Auth middleware**, then `requireSelf`: the `:username` in the path must
   equal the token's `sub`. In no-auth dev mode `trustMiddleware` takes the path
   param *as* the subject (`coordinator/auth.ts`; only reachable in a local
   checkout that set `ALLOW_NO_AUTH`).
2. **`registerBoard`** — serialized per `(user, board)` through a promise map, so
   two registrations cannot interleave. It lifts the browser bridges out of the
   old session, `await`s `destroy()` (which **DELETEs** the runtimes that session
   provisioned), starts a new `BoardSession`, and re-attaches the bridges — so a
   watching browser sees no disconnect.
3. **Per remote runtime — `provision()`:**
   - `assertRuntimeUrlAllowed(url)` — SSRF guard. Board configs are untrusted
     (shared, imported), so blocked targets are refused before any request
     leaves the process.
   - `POST /runtimes` with `garbageCollected: false`, authenticated with the
     **user's forwarded JWT**. Always a POST: registering a board is a deploy,
     so it creates-or-replaces. (Attaching to something already running belongs
     to resuming a board — not built, see below.)
   - `POST /runtimes/:id/session-token` with the same JWT. The runtime server
     returns a random opaque string bound to `{sub, runtimeId}`, held in memory.
   - The coordinator opens **its own** WebSocket to `outputUrl`, authenticated
     with that session token.
   - `assertRuntimeUrlAllowed(outputUrl)` again — a hostile target could try to
     redirect the socket somewhere blocked.
4. **Mounts, after every runtime exists** — `collectMountAddresses()` reads each
   runtime's services and records what they published in `__hkpMount`;
   `publishMountAddresses()` configures consumers with the resolved addresses.
   Two passes because a service can point at a mount on a runtime provisioned
   later. The board keeps its `hkp-mount://` references — an address is only
   true of one run.

### Why session tokens exist

The coordinator's long-lived calls — its result socket, teardown — must keep
working after the user's id token expires. The session token is **the user's
permissions, delegated**: it resolves back to their `sub`, so there is no
service superuser. It lives in the runtime server's memory only; if that process
dies, the coordinator has to re-provision, which needs a live user JWT.

---

## Runtime lifecycle

Declared by whoever creates the runtime, in the **create payload** — never
inferred from who is connected, never a header:

| `garbageCollected` | Meaning | Who says it |
| --- | --- | --- |
| `true` | reap when the last client socket closes | a browser: its runtimes should not outlive the tab |
| absent / `false` | persist until an explicit `DELETE` | coordinators, config files, scripts |

The default is **persist**, so nothing that exists today starts disappearing,
and a runtime is never reaped over who happened to connect. A runtime nobody
ever connected to is never reaped — cleanup happens when a client *goes away*.

All three runtime servers honour it: `hkp-node/tests/runtime-lifecycle.test.ts`,
`hkp-python/tests/test_runtime_lifecycle.py`,
`hkp-rt/tests/runtime_lifecycle.test.cpp`.

This is also what makes replacement safe: a deploy replaces the browser's
runtime with one that persists, so the browser's dying socket cannot reap the
coordinator's fresh runtime.

---

## Attached: what a viewer may do

`views/cloud/bridgeRuntimeApi.ts` builds scopes that **open no socket** — the one
bridge socket already carries every runtime's state, and a cloud runtime may
live where the browser has no route to it at all.

- **Reads** come from the coordinator's snapshot (`CoordinatorSnapshotStore`),
  which carries config + registry + live service state, and mount addresses that
  no saved board can contain.
- **Configure** is a request over the bridge.
- **Notifications** ride the bridge as their own message type. They are *not*
  state: a Monitor's output is deliberately absent from `getState()`, so a
  browser rendering state alone would show an empty Monitor on a running board.
- **Structural edits are refused.** Adding a service means owning the board.

Leaving the cloud view closes bridge scopes; it does not delete runtimes. A
deployed board keeps running.

---

## When touching this area

- **Ownership before anything.** Ask who provisioned the runtime you are about
  to change or delete. Runtime ids are the board's, so "it has the right id" is
  not evidence that it is yours.
- **Ids are per user, not global.** hkp-node namespaces runtimes by the
  authenticated `sub`, so the stable ids boards ship (`node`, `chat-node`) do not
  collide between people — and *do* collide between a browser and a coordinator
  acting for the same person. That collision is the mechanism, not a bug.
- **Cloud boards with browser runtimes cannot run headless.** The coordinator
  drives those over the bridge, so that part of the chain stalls with no viewer.
- **Reconnection is a real state.** A dropped bridge re-snapshots; it does not
  resume blindly. Snapshots carry a `seq` for gap detection.
- **Mount references, not addresses, are what a board stores.** Resolution is
  lazy and belongs to the coordinator — only it sees the whole board.

---

## Persistence

A coordinator keeps its boards as one JSON file each, under
`HKP_COORDINATOR_DATA_DIR` (default `~/.hkp/coordinator/boards`). Setting that
variable to the empty string keeps them in memory instead.

**It persists the board, not the run**: `userId`, `boardName`, `createdAt`,
`config`. Never the provisioned runtimes, live service state, registries, mount
addresses, session tokens or status — each describes one run against processes
that may not exist on load, so writing them down would persist claims that are
false when read back.

- **Paths are hashed**, never built from the names: `<sha256(userId)>/<sha256(boardName)>.json`.
  Both names come off the wire, so a board called `../../etc/passwd` must not
  escape the root — and `Foo` and `foo`, two boards to the coordinator, must not
  become one file on a case-insensitive filesystem. Real names live inside.
- **Writes are temp-then-rename**, so a crash leaves the previous board intact
  rather than half of the new one. Files are `0600`, directories `0700`: a board
  config carries service state, which can carry credentials.
- **A restored board is stopped**, and can be nothing else — provisioning and
  minting a session token both need the user's JWT, and at boot there is no
  user. Starting it is the owner's move.
- **A corrupt or newer-format file is skipped and logged**, never fatal.
- A failing save does not fail a deploy: the board runs, and only its survival
  of a restart is in doubt.

### One directory, one coordinator

Not enforced, and worth knowing: two coordinator processes pointed at the same
data directory both restore every board and both believe they own them. They
would then provision the same runtime ids against the same runtime servers and
replace each other's runtimes, which looks like runtimes randomly restarting.
There is no lock — keep a data directory to a single coordinator.

### The orphan window

Runtimes are provisioned to persist, so they outlive the coordinator that made
them. After a restart they are still running with nothing tracking them —
holding their mounts, keeping their state. Pressing **Start** re-registers the
same config under the same runtime ids, and `POST /runtimes` replaces, so the
orphan is destroyed and rebuilt. A board that is never started again keeps its
orphan; nothing sweeps for them.

`tests/coordinator-restart.test.ts` covers this end to end.

Stopping reports the same kind of residue: a runtime the coordinator could not
release is very likely still running, so `stop()` collects those and the board
carries them in `errors[]` while its status stays `stopped`. A `404` is not one
of them — it means there is no such runtime, which is what was asked for. The
runtimes disagree about saying so (hkp-node answers `200` whether or not it held
one; hkp-python and hkp-rt answer `404`), so anything treating every non-2xx as
a failure will cry wolf on two of the three.

---

## Forking a deployed board

A deployed board is the coordinator's; the way back to an editor is to **fork**
it — "Fork board" in the start page's details column, for boards opened from a
coordinator. The host reads the board's config from the coordinator, copies it
with `hkp-frontend/src/core/forkBoard.ts`, saves it and opens it. Stopping the
original and deploying the fork stays the user's call.

**Every id is renamed, and everything naming an id is renamed with it.** A copy
that kept them would provision over the runtimes the original is running on —
an editor whose changes land on the deployed board. What gets rewritten:

| Kind | Where |
| --- | --- |
| Runtime ids | `runtimes[].id`, the keys of `services`, `targetRuntime`, `runtimeId` |
| Service ids | each service `uuid`, the `instanceId` of services nested in a pipeline, `targetServiceUuid`, the facade's `serviceUuid` |
| Mounts | `__hkpMount`, when it holds a `hkp-mount://` reference |

Rewriting is driven by **field name, not by value**: an id like `node` or
`mon-1` is an ordinary string that can appear anywhere in a board, and replacing
every occurrence would corrupt data that merely reads like an id. The cost is
that a service inventing its own way to name another service is not carried
across — `KNOWN_REFERENCE_FIELDS` in that file is where such a field is added.

A `__hkpMount` holding an *address* rather than a reference is left as it is: it
may name something outside the board entirely, and a fork has no basis for
deciding it meant the copy. An owner's runtime republishes its own address on
load regardless.

---

## Not built

- **Resuming** a board a coordinator already runs (the `GET`-first path on the
  coordinator side). Registering always deploys — which is also what Start does
  to a stopped board: the coordinator kept its config, so starting it is
  registering that config again.
- **Fork a deployed board** back into the playground. It needs runtime ids
  regenerated on copy, or the fork attaches to the live board's runtimes and
  edits land on the deployed one. Until then, changing a deployed board means
  changing it in a playground tab and deploying again.
