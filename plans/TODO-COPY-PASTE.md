# Copy & paste — a clipboard for runtimes, then services

Status: concept only. Nothing here is built. Analysis 2026-09-23, from
`hkp-frontend/src/core/forkBoard.ts` outwards.

Companions: `TODO-SCOPES.md` (scoped addresses are what makes the remapping
non-obvious), `hkp-frontend/src/runtime/board/units.ts` (the other mechanism
that renames runtime ids), `docs/content/concepts/mounts.md` (endpoint
addresses derived from those ids).

**Status legend:** ☐ not started · ◐ in progress · ☑ done · ✎ needs design

---

## The problem

Putting a second copy of a runtime on a board is not copying a document. A
board's ids are **claims on things outside the document**: a runtime server
namespaces its runtimes by id, a mount address is derived from one, a facade
widget names a service by one, and a service names another service by one. Copy
a runtime verbatim and the copy does not become a second runtime — it becomes a
second *name for the same one*, in the worst case silently.

So a clipboard is one question: **what must be renamed, and what references the
renamed thing?** Everything else — a menu item, a keystroke — is small.

---

## What already exists

Three half-solutions, none of them the clipboard:

| Mechanism | What it does | Why it is not enough |
| --- | --- | --- |
| `core/forkBoard.ts` | Copies a **whole** board, renaming every id and repointing every reference | Whole-board only, and it breaks scoped addresses (trap 1) |
| `components/Runtime.tsx:284` "Save to Disk" + `views/playground/Board/index.tsx:113` `onRuntimeDrop` | Writes one runtime to JSON, and drops one back onto a board | **Remaps nothing.** Reuses `data.id` and the service uuids verbatim, so dropping the same file twice collides. Goes through `setBoardState`, which tears down and restores every runtime on the board |
| `components/DropTypes.ts` service-instance drag | Drags a live service into another runtime | Passes `prototype.uuid` through as the new instance id (`core/serviceOperations.ts:37`) — a move, not a copy |

The pieces are there. What is missing is **one remapper they all share**, and an
**incremental insert** that does not restart the board.

---

## The remap surface

Everything in a board fragment that carries an id, and everything that names one:

**Structure**
- `runtimes[].id` — also the key of the `services`, `scopes` and `registry` maps
  in `BoardContext`
- `services[rtId][].uuid` — top-level services
- `instanceId` — services nested in a pipeline

**References, by field name** (`forkBoard.KNOWN_REFERENCE_FIELDS`)
- `targetServiceUuid`, `serviceUuid` (Configurator, ProcessRouter, facade
  widgets and notices), `targetRuntime`, `runtimeId`

**References, by scheme**
- `hkp-mount://<runtimeId>/<serviceUuid>`, legal in whatever field a service
  calls its target (`runtime/board/mount.ts`)
- `__hkpMount` holds an *address*, not a reference. It is a runtime fact
  published by an owner or written by the coordinator — a copy drops it rather
  than carrying it

**Scoped addresses** (`runtime/board/address.ts`)
- `read.feeds` — segment 0 is a top-level uuid; the rest are scope-local names

**Server-side identity**
- REST `restoreRuntime` tries `attachRuntime` first
  (`runtime/rest/RuntimeRestApi.ts:271`): the same id on the server means
  *attach to that runtime*, not create a second one. A fresh id is mandatory,
  not cosmetic
- A mount address is `HMAC(owner, boardName, runtimeId, mountName ?? serviceUuid)`
  (`hkp-node/src/mounts.ts:116`), so a new runtime id gives the copy fresh
  endpoints for free

**Host bookkeeping**
- `localStorage["runtimes-<boardName>"]` — browser-runtime ownership
  (`core/runtimeOperations.ts:9`)
- The runtime **`name`**: `processRuntimeByName` takes the *first* match
  (`views/playground/Board/index.tsx:99`), so a duplicate name is ambiguous
  rather than wrong, which is worse
- `unit`, `unitRuntimeId` and the unit's `boardName` — provenance

Secrets need nothing: a board holds `{{secret.alias}}`, which is alias-keyed and
survives a copy untouched. Only the legacy per-service vault path
`<serviceUuid>.<field>` would be orphaned by a new uuid.

---

## Decided

### Rename only the top-level ids

Runtime ids and top-level service uuids are renamed. **Nested `instanceId`s are
left exactly as they are.** They are scope-local — "an instanceId is unique only
inside its own pipeline, so on its own it is a name, not an address"
(`runtime/browser/services/BrowserSubService.tsx:427`). Renaming them buys
nothing and forces every dotted address's *tail* to be rewritten with them.

This is the decision that makes the remapping tractable rather than error-prone:
with it, a scoped address only ever changes in segment 0.

### A dotted address is rewritten segment by segment

`read.feeds` under `read → read-9f2` becomes `read-9f2.feeds`. Rewriting by
whole-string lookup — what `forkBoard` does today — misses it, because the map is
keyed by bare ids.

### Paste is an insert, not a board restore

A paste provisions **one** runtime and adds it to the four state maps, the way
`addRuntime` already does. It never touches the runtimes already on the board.
The existing file-drop path restores the whole board, which is both slow and a
visible interruption of everything that was running.

New runtimes land at the **end of the chain**. Runtime order is pipeline order,
so inserting in the middle would silently change what feeds what; dragging to
reposition already exists.

### The payload is a board fragment, and outlives the page

`{ kind: "runtime", runtime, services }` — a document, not a live handle. Kept
module-level **and** in `localStorage`, so a copy survives a reload and works
between boards and between tabs. Copying a *live* runtime serialises through the
same `getServiceConfig` path as `serializeBoard`, so what is copied is the state
the services are actually in, not the descriptor they were loaded with.

### Paste renames the runtime

`Node 2` pasted becomes `Node 2 copy`, then `Node 2 copy 2`. Not cosmetic:
`processRuntimeByName` resolves to the first match, so two runtimes under one
name is a board whose behaviour depends on list order.

### The facade is not copied

A pasted runtime's services are unreferenced by the facade, and that is the
right answer — a widget belongs to the panel that shows it, and duplicating
widgets would put two controls with the same title on one screen. The check
added in `01a1e5d` stays quiet either way, since nothing new is pointed at.

---

## Traps found

1. **`forkBoard` breaks scoped addresses.** Verified 2026-09-23 by running it on
   a board shaped like `boards/rss-demo-board.json` (top-level uuids `read` and
   `list`, facade pointing at `read.feeds`): `read` is renamed to `read-<token>`
   while `"serviceUuid": "read.feeds"` is left untouched and now dangles. Real
   boards are full of these — `rss-demo-board.json` and
   `hold-scopes-demo-board.json` both address services this way. Any paste built
   on that rewriter inherits the bug, which is why phase 0 fixes it in place
   rather than working around it.
2. **The runtime file drop remaps nothing** (`Board/index.tsx:113`). Dropping the
   same saved runtime twice puts two runtimes with one id on the board; for a
   REST runtime the second one *attaches to the first* on the server.
3. **Unit provenance must be stripped.** A copy that keeps `unit` +
   `unitRuntimeId` is written back **into the unit document** on save
   (`units.ts` `unlinkProjection`), under an id identical to the original's —
   corrupting the reusable thing rather than the board. `stripProvenance`
   already exists there. The unit's `boardName` goes with it: hkp-node keys an
   unnamed database file and derives mount addresses from it.
4. **An explicit `mountName` collides within one runtime.** Two services in one
   runtime deriving the same mount id is not reported — `mounts.set(mountId, …)`
   silently replaces the earlier one. Harmless for a pasted *runtime* (the
   runtime id differs), a real hazard for a pasted *service* (phase 4).
5. **Pasting a REST runtime provisions a second runtime on that server.** Ports,
   credentials and connections are doubled. Correct, but worth saying out loud.

---

## Phase 0 — one remapper, pure and tested

New `hkp-frontend/src/runtime/board/rename.ts`. Pure, no board state, no React.

- ☐ `freshIds(fragment)` — mints ids for runtimes and top-level uuids, returns
  the two maps
- ☐ `remapIds(fragment, { runtimes, services })` — the four reference kinds:
  field name, mount scheme, dotted segment 0, and dropping `__hkpMount`
- ☐ Nested `instanceId`s explicitly left alone, with the reason in a comment
- ☐ Rebuild `core/forkBoard.ts` on it — its existing suite
  (`core/tests/forkBoard.test.ts`) is the regression net
- ☐ A fork test for the scoped address that trap 1 found

## Phase 1 — the payload

New `hkp-frontend/src/core/clipboard.ts`.

- ☐ `copyRuntime(runtimeId, refs)` — serialises one runtime through
  `getServiceConfig`, so live state rather than the loaded descriptor
- ☐ Strips `unit`, `unitRuntimeId`, the unit's `boardName`, and `__hkpMount`
- ☐ Store: module-level, mirrored to `localStorage` under one key, with a size
  cap and a tolerant read (a payload from an older shape is discarded, not
  thrown)
- ☐ `clipboardContents()` for the UI to label and enable the paste item

## Phase 2 — paste as an insert

- ☐ `insertRuntime(fragment, refs)` in `core/runtimeOperations.ts`: fresh ids,
  a free name, `api.restoreRuntime`, then `setRuntimes` / `setServices` /
  `setRegistry` / `setScopes` — the shape `addRuntime` already has
- ☐ `registerBrowserRuntime` for a browser runtime, as ownership works today
- ☐ Point `onRuntimeDrop` (`Board/index.tsx`) at the same function, which fixes
  trap 2 and stops the whole-board restore
- ☐ Board marked changed, so a snapshot follows (`markBoardChanged`)

## Phase 3 — the UI

- ☐ "Copy" in `ui-components/runtime-ui/RuntimeSettings.tsx`, beside "Save to
  Disk"
- ☐ "Paste runtime" in `ui-components/toolbar/RuntimeMenu.tsx` — labelled with
  what is on the clipboard, absent when it is empty
- ☐ ⌘C / ⌘V on the selected runtime, through the keydown handler already in
  `views/playground/PlaygroundController.ts:270` and `selection/SelectionContext`
- ☐ Suppressed while focus is in a field or the board source editor
- ☐ Mobile: an item in the runtime sheet (`views/playground/mobile/`) — after
  the desktop path works

## Phase 4 — services

Same machinery, one new hazard.

- ☐ `kind: "service"` payload, pasted into the selected runtime at an index
- ☐ An explicit `mountName` is cleared or suffixed when pasting into the same
  runtime (trap 4)
- ☐ Decide what the service-instance *drag* means once copy exists — today it
  moves; ✎ whether a modifier should make it copy

---

## Tests

- ☐ Remapper: dotted addresses, mount references in an arbitrary field,
  published addresses left alone, nested pipelines untouched, a reference to
  something outside the fragment left alone
- ☐ Paste twice produces two runtimes with distinct ids, uuids and names
- ☐ Paste does not restart the runtimes already on the board (the point of
  phase 2)
- ☐ Pasting a unit-contributed runtime yields one the composition owns
- ☐ Round trip: copy → paste → save → reload, and the copy still runs
- ☐ A REST paste creates a second runtime on the server rather than attaching
  to the first

---

## Open

- ✎ **Copying more than one thing at a time.** A multi-select on the canvas does
  not exist; the payload shape (`kind`) is where it would go.
- ✎ **Pasting into a runtime that is not the selected one.** Today the selection
  is the only aim the keyboard has.
- ✎ **Cross-machine paste.** The payload is a document, so nothing prevents it
  travelling — but a runtime `url` that is true on one machine is not on
  another, which is `TODO-COORDINATOR-CONNECTIONS.md`'s problem, not this one.

## Rejected

**Renaming nested `instanceId`s.** What `forkBoard` does today. It makes every
dotted address a two-part rewrite and every scope's internal references a
liability, in exchange for uniqueness nothing asks for — nested names are
scope-local by construction.

**Copying by re-running the board through `setBoardState`.** The path the file
drop takes. It works, and it restarts everything on the board to add one
runtime; anything mid-run, connected or holding state pays for it.

**Renaming by value rather than by field name.** Tempting for scoped addresses,
and wrong for the same reason `forkBoard` already gives: an id like `node` or
`read` is an ordinary string that can occur in data, and replacing every
occurrence corrupts what merely reads like an id.
