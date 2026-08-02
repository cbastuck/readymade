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

## Not built

- **Resuming** a board a coordinator already runs (the `GET`-first path on the
  coordinator side). Registering always deploys.
- **Fork a deployed board** back into the playground. It needs runtime ids
  regenerated on copy, or the fork attaches to the live board's runtimes and
  edits land on the deployed one. Until then, changing a deployed board means
  changing it in a playground tab and deploying again.
