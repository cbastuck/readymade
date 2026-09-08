# Cloud boards: the coordinator owns the board

Plan for a fresh session. Decisions are made (Aug 2026); nothing below is
implemented yet.

---

## The problem this fixes

Today **two parties provision the same remote runtimes** of a cloud board:

- the coordinator, in `BoardSession.start()` → `POST /runtimes` per remote runtime;
- the browser, because the cloud view calls `setBoardState(board.config)`
  (`hkp-frontend/src/views/cloud/index.tsx`) → `restoreBoard` → `restoreRuntime`
  → `POST /runtimes` for the same ids.

On **hkp-node** that is survivable: `POST /runtimes` with an existing id reuses
the running runtime rather than rebuilding it (`src/server.ts`, with a comment
saying exactly why — "lets a browser reconnect to a coordinator-managed board
without killing services"). Services keep their state and mounts keep the
addresses already handed to consumers. That property is now pinned by
`tests/cloud-reprovision.test.ts`; nothing had covered it before.

On **hkp-python and hkp-rt it is not**: both rebuild on a repeat id
(`RuntimeApp.create_runtime` → `existing.destroy()`;
`App::appendRuntime` → `removeRuntime`). There a browser attaching restarts the
runtime, so timers reset and every mount gets a new `/hosted/<id>` — stranding
the addresses the coordinator resolved. Pinned as a known divergence in
`hkp-python/tests/test_reprovision.py`; see TODO-CONSOLIDATION.md.

Two provisioners is still the wrong shape even where it is survivable: it means
the browser has to be able to reach every remote runtime host at all, and it
leaves "who owns this runtime" answered by whoever called last. The browser also
talks to every remote runtime directly for configure, process and state
(`RuntimeRestApi`), and opens a notification WebSocket per runtime
(`RuntimeRestScope`).

---

## Decisions

**Ownership.** The coordinator owns the board: it provisions the remote runtimes
and owns their lifecycle and state. The browser never provisions them.

**Invariant.**

| | Owner of truth | The other side holds |
| --- | --- | --- |
| Remote runtimes | coordinator | a shallow cache in the browser, for rendering |
| Browser runtimes | the browser | cached data in the coordinator |

**Traffic.** Everything to a remote runtime goes through the bridge. The browser
never dials a runtime host, so a cloud board's runtimes may live somewhere the
browser cannot reach — which is the point of having a coordinator.

**Snapshots.** On attach the coordinator pushes: authored config, board status,
each remote runtime's **service registry**, and each service's **live reported
state**; incremental notifications follow, numbered so a gap is detectable. The registry matters — panel selection resolves
by `serviceId` *and* `version` (see `SubServicePipelineUI`), so without it cloud
boards render the wrong UIs. Live state matters because published `__hkpMount`
addresses are assigned at provision time and are absent from a saved board.

**Security.** Considered and dismissed for now: the runtime's opacity protects
data from *outsiders*, and the person opening a cloud board is its owner. Their
consent is implied by opening it. Revisit only with real rights management.

**Mount direction.** Only server-backed runtimes own mounts; browser services can
only consume one. Addresses therefore flow coordinator → browser only, and there
is no reverse-resolution problem to design.

---

## Work breakdown

### 1. Pin today's behaviour — **done**

`hkp-node/tests/cloud-reprovision.test.ts` pins reuse-by-id: a repeat
`POST /runtimes` keeps the running runtime, its mounts and its services' state;
it ignores the services the second caller asked for (so it is not an update
path); and a coordinator-resolved address keeps serving after a browser
attaches. `hkp-python/tests/test_reprovision.py` pins the opposite behaviour on
python as a known divergence.

Written first as an assertion that re-provisioning *strands* addresses — which
was wrong, and the tests said so. Worth remembering: the premise of this plan
was half mistaken until it was executed.

### 2. Bridge protocol

Extend the bridge (`useCoordinatorBridge` ↔ `BoardSession.registerBrowserSocket`).
Today it carries `connect`, `processRuntime` (coordinator → browser) and
`result` / `result-from-browser` back.

Add, coordinator → browser:

- `snapshot` — config + per-runtime registry + live service state; sent on attach
  and on reconnect;
- `serviceState` — incremental, from the runtime notifications the session
  already consumes (Phase B made it listen to them);
- `browserRuntimes` — which browser runtimes this board expects the browser to
  create.

Add, browser → coordinator (request/response, reusing the existing `requestId`
pattern):

- `configureService`, `processService`, `processRuntime`.

Include a sequence number on snapshots and increments so a browser can detect a
gap and ask for a fresh snapshot rather than drifting.

### 3. A bridge-backed runtime scope (the bulk of the frontend work)

Remote runtimes in a cloud board need a `RuntimeScope` that is **not**
`RuntimeRestScope`: same interface, but `configureService` / `processService`
route over the bridge, and state arrives from snapshots instead of a per-runtime
WebSocket. Board loading needs a *hydrate-without-provisioning* path that builds
these scopes from a snapshot instead of calling `restoreRuntime`.

Keep the optimistic-UI contract panels already rely on: configure locally, then
reconcile when the coordinator echoes the new state.

### 4. Wire the coordinator prop

`BoardProvider` already takes an optional `coordinator` (added in the mount work,
with tests covering both branches). The cloud view passes an implementation whose
`getServiceState` / `resolveMountUrl` read the snapshot cache. This step is small
once step 3 exists — two implementations of one interface, chosen by the host.

### 5. Verify

An end-to-end test: a browser service resolves a mount owned by a remote runtime
in a cloud board, and the address is still live after a browser attaches — the
claim none of this has today.

---

## Editing a cloud board

Superseded — see "deploy instead of a toggle" below. A cloud board is attached,
never edited in place: it is owned by the coordinator that provisioned it, and
changing it means changing the board in the playground and deploying again.

## Consequences worth remembering

- **Cloud boards with browser runtimes cannot run headless.** The coordinator
  drives them over the bridge, so that part of the chain stalls with no viewer
  attached. Already true; worth stating in the docs rather than discovering.
- **Auth simplifies.** The browser stops needing credentials for remote runtimes;
  the coordinator's session tokens are the only ones in play, and a runtime's
  allowlist only has to admit the coordinator.
- **Reconnection is a real state.** Bridge drops must re-snapshot, not resume
  blindly.
- **Attach and provision are now separate calls.** The browser asks with `GET`
  before posting (`RuntimeRestApi.attachRuntime`), so a viewer attaching no
  longer depends on a server choosing to reuse. That removes the sharp edge on
  every runtime, ahead of this plan — the plan is now about *ownership and
  reachability*, not about surviving a viewer.

---

## Next: lifecycle by declaration, and deploy instead of a toggle

Agreed Aug 2026, after the first round of testing. Supersedes the Edit / Save &
Run toggle described above.

**Runtime lifecycle is declared when a runtime is created**, in the create
payload — not inferred from who is connected, and not asserted in a header:

- `garbageCollected: true` — reap when the last client socket closes. The
  playground says this about the runtimes it provisions: the browser is the
  controller, and its resources should not outlive it.
- absent or `false` — persist until an explicit DELETE. Coordinators, config
  files and scripts fall here by saying nothing.

Only hkp-node reaps today; hkp-python and hkp-rt leak. Aligning them is part of
the work, and the default must be *persist* so that neither of them starts
reaping runtimes that exist today.

**Deploy replaces the toggle.** Boards are built in the playground, where the
browser owns them, and a Deploy action hands one to a coordinator. Editing never
stops a running board — you edit a copy and deploy over it. Deploy is
POST/replace; a coordinator resuming a board it already runs still attaches with
GET first.

### Steps

1. ~~**hkp-node**: `garbageCollected` in the create payload, default persist;
   reap only when declared. Remove `x-hkp-managed-by` and the
   mint-implies-managed rule.~~ **Done** — `tests/runtime-lifecycle.test.ts`.
2. ~~**Frontend**: the playground declares `garbageCollected: true` when it
   provisions; the coordinator declares `false`.~~ **Done.**
3. ~~**hkp-python and hkp-rt**: implement reaping, honouring the same flag.~~
   **Done** — `hkp-python/tests/test_runtime_lifecycle.py`,
   `hkp-rt/tests/runtime_lifecycle.test.cpp`. All three runtimes now reap only
   what declared itself, and hkp-node's unconditional reaping is gone.
4. ~~**Coordinator**: make deploy (POST/replace) and resume (GET/attach) an
   explicit split rather than an inference.~~ **Done** — registering a board
   provisions; `POST /runtimes` creates-or-replaces on all three runtimes, and
   hkp-node's reuse-by-id is gone. Attaching stays a `GET`, which the browser
   already does before posting. Nothing resumes a board yet, so no resume path
   was built.
5. ~~**Frontend**: a Deploy action in the playground that picks a coordinator;
   the cloud view becomes attach-only.~~ **Done** — `DeployMenu` in the toolbar,
   `core/deploy.ts` (`core/tests/deploy.test.ts`). Deploying gives up the
   runtimes *before* the coordinator provisions them, because both sides use the
   board's ids: `BoardContext.handOverRuntimes` stops the browser from deleting
   them on its way out (`core/tests/deploy-handover.test.tsx`).
6. ~~Retire the Edit / Save & Run toggle and the editing mode it needed.~~
   **Done** — the cloud view attaches only. Its "Stop" keeps the board and its
   config, and "Start" registers that config again; "New board" opens the playground rather than creating an empty record
   this view could no longer fill.
7. ~~Say the model in the UI.~~ **Done** — the deploy menu leads with "Runs in
   this browser — closing the tab stops it"; an attached board says "Deployed to
   «coordinator» — it keeps running when you close this".

### Not built: editing a deployed board

There is no way back from a deployed board to the playground, by decision — that
is the parked fork below. Until it exists, changing a deployed board means having
the board in a playground tab and deploying it again.

### Done

- ~~**Fork a deployed board** into the playground.~~ **Done** — "Fork board" in
  the start page's details column (`core/forkBoard.ts`,
  `core/tests/forkBoard.test.ts`), wired in both hosts. Ids are regenerated and
  every reference to them rewritten; see CLOUD-BOARDS.md for which fields those
  are and why the rewrite is driven by field name rather than value.

### Parked by decision

- **Adopt-on-start** instead of rebuilding. Start replaces the orphan today,
  which is clean but changes mount addresses; adopting would preserve them (and
  live state) across a coordinator restart. Revisit if a board handing its mount
  URL to something external turns out to be the common case.
- **Auto-start on boot** — not possible under the current auth model: both
  provisioning and minting a session token need the user's JWT.
- **A lock on the data directory.** One directory belongs to one coordinator;
  documented rather than enforced.
- **Remembering that a board was running** before a restart. Boards persist,
  runs do not — one rule.

## Done since

`referenceMount` (address → `hkp-mount://` reference) had no caller and was
deleted, with its tests. Code that nothing calls looks supported; if board
export ever needs to rewrite addresses back into references, it is a small
function to write again against a real caller.
