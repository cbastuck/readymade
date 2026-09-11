# Vocabulary

The words this project uses about itself, and what each one is in the code.

---

## What this is for

Every project grows a private language. Somebody says "the board menu", "a
mount", "the consent dialog" — and everyone in the room knows what is meant and
nobody could point at the file. That gap costs an afternoon when a new person
joins, and it costs an AI assistant far more: given a term it cannot resolve, it
will search, guess, and edit something adjacent.

So this is a lookup, not a tutorial. One line per term, saying what it is and
where it lives. It is deliberately **finer-grained than the concepts**: a concept
is an idea worth a page (`concepts/board.md`), while a term here can be a single
dialog. Every concept appears below, so that entering by either door works.

**It is written by people, not generated.** Which words matter, and which files
are the ones worth naming, is a judgment no scan can make — a directory listing
would be complete and useless. What is automated is the opposite half: checking,
against a changeset, whether what an entry points at has moved. See *Keeping it
true* at the end.

A reference is a path, sometimes with the symbol that matters:
`path/to/file.ts` or `path/to/file.ts#exportedName`. The first reference in a row
is the one to open first.

---

## The interface

Two bars are called a toolbar and two menus sit in one of them, so this section
is the one worth being pedantic in.

| Term | What it is | Where it lives |
|---|---|---|
| **Toolbar** | The bar above an open board: board menu, board name, status, view controls, share, app menu. | `hkp-frontend/src/components/Toolbar/index.tsx` |
| **TopBar** | The *start page's* bar — title, version badge, logo. A different bar in a different view; not the Toolbar. | `hkp-frontend/src/views/start/TopBar.tsx` |
| **AppMenu** | The application-level dropdown in the toolbar: account, dashboard, theme, log out. About the app, not the board. | `hkp-frontend/src/ui-components/toolbar/AppMenu.tsx` |
| **BoardMenu** | The board-level dropdown beside it: save, load, and whatever else the host contributes through a `BoardMenuItemFactory`. About this board. | `hkp-frontend/src/ui-components/toolbar/BoardMenu.tsx`, `hkp-frontend/src/types.ts#BoardMenuItemFactory` |
| **ShareMenu** | The third dropdown in the toolbar: the ways a board is handed to somebody else — a self-contained link, cloud access by email, a partner board QR. What distinguishes it from the BoardMenu beside it is direction: that one operates on the board you have open, this one gives it away. | `hkp-frontend/src/components/Toolbar/ShareMenu.tsx` |
| **SaveBoardDialog** | Name and description on save, offering a suggested name. | `hkp-frontend/src/components/SaveBoardDialog.tsx` |
| **Start page** | The Finder-style entry view: sources in columns, boards inside them, details on the right. | `hkp-frontend/src/views/start/StartPage.tsx`, `hkp-frontend/src/views/start/ColumnBrowser.tsx` |
| **Source** | One column root on the start page — saved boards, demos, remotes, cloud boards. | `hkp-frontend/src/views/start/demosSource.ts`, `hkp-frontend/src/views/start/useCloudBoardsFolder.ts` |
| **Service panel** | A service's own UI, or the generic panel when it has none. | `hkp-frontend/src/runtime/browser/UIRegistry.ts` |
| **Nested navigation** | Drilling into a sub-pipeline as its own layered level, with breadcrumbs; levels stay mounted so panels keep running. | `hkp-frontend/src/runtime/ui/NestedNavigation.tsx` |
| **Density** | The compact/comfortable axis, independent of the colour theme (`data-density`). | `hkp-frontend/src/ui-components/ThemeContext.tsx` |

---

## The board

| Term | What it is | Where it lives |
|---|---|---|
| **Board** | The top-level container: a named JSON document holding runtimes, their services and an optional facade. → `concepts/board.md` | `hkp-frontend/src/types.ts#BoardDescriptor`, `hkp-frontend/src/core/boardPersistence.ts` |
| **Board context** | The live board while it is open — its runtimes, scopes, services, facade and linkage — and the actions that change them. Everything on screen reads from here. | `hkp-frontend/src/BoardContext.tsx` |
| **Facade** | The app-like surface of widgets drawn over a board, so somebody can use it without seeing services. → `concepts/board.md` | `hkp-frontend/src/facade/types.ts`, `hkp-frontend/src/facade/FacadeRenderer.tsx` |
| **Widget** | One control or display in a facade — a button, knob, level meter, data table — usually addressing a service by `serviceUuid`. | `hkp-frontend/src/facade/types.ts#LayoutItem`, `hkp-frontend/src/facade/panels/` |
| **View mode** | Which half of a facade board is on screen: facade, split, or board. One three-state mode rather than two switches, so "at least one half is visible" is structural. | `hkp-frontend/src/facade/FacadeViewContext.tsx`, `hkp-frontend/src/facade/FacadeViewControls.tsx` |
| **Overview** | The full-window 3D-ish view of a whole board — every runtime, service and nesting level at once, with live activity. | `hkp-frontend/src/overview/OverviewView.tsx`, `hkp-frontend/src/overview/OverviewContext.tsx` |
| **Board JSON** | The serialised form of a board. What is saved, shared by link, exported and deployed. | `hkp-frontend/src/core/boardPersistence.ts#serializeBoard` |
| **Partner board** | The board for the other side of a peer connection, derived from the open one: the same board with its `peer-socket` roles swapped and its machine-local runtimes dropped, handed over as a link or a QR code. Derived one way only, so the share menu and a facade's `partner-board-qr` button hand out the same board. | `hkp-frontend/src/core/partnerBoard.ts#createPartnerBoard`, `hkp-frontend/src/components/Toolbar/ShareMenu.tsx` |
| **Board action** | A facade widget action naming no service, because its subject is the board — what it does is the host's to decide, and a host that cannot do it leaves the button inert. | `hkp-frontend/src/facade/types.ts#BoardAction`, `hkp-frontend/src/facade/FacadeBoardActions.tsx` |

---

## Runtimes and services

| Term | What it is | Where it lives |
|---|---|---|
| **Runtime** | Where services run — a browser tab, a Node/Python/C++ process. Chained in board order. → `concepts/runtime.md` | `hkp-frontend/src/types.ts#RuntimeDescriptor`, `hkp-node/src/runtime.ts`, `hkp-python/src/hkp/runtime.py`, `hkp-rt/lib/src/runtime.cpp` |
| **Service** | The unit of work: configure, process, optional panel, a place in an ordered list. → `concepts/service.md` | `hkp-frontend/src/types.ts#ServiceDescriptor`, `hkp-frontend/src/runtime/browser/services/` |
| **Pipeline** | A runtime's ordered service list, which is the wiring — and the loop that walks it, one service at a time, stopping on `null`. Every runtime implements its own; these are the four. | `hkp-frontend/src/runtime/browser/BrowserRuntimeScope.ts#next`, `hkp-node/src/runtime.ts#processFromIndex`, `hkp-python/src/hkp/runtime.py#_process_from_index`, `hkp-rt/lib/src/runtime.cpp#processFrom` |
| **Chain** | The step *between* runtimes: when one finishes, which one runs next and how its result gets there. Decided by whoever owns the board — the board view in the browser, the coordinator's session for a deployed board, which also has to reach a browser runtime over the bridge. | `hkp-frontend/src/views/playground/Board/index.tsx#onRuntimeResult`, `hkp-node/src/coordinator/session.ts#routeResult` |
| **Sub-service / nested pipeline** | A service owning a pipeline of its own, run as one step of the outer one. | `hkp-node/src/services/sub-service.ts`, `hkp-rt/lib/src/sub_runtime.cpp` |
| **Runtime API / scope / app** | The three seams: verbs per runtime *type*, one live runtime, and what a service may do. | `hkp-frontend/src/types.ts#RuntimeApi`, `#RuntimeScope`, `hkp-frontend/src/runtime/browser/BrowserRuntimeApp.ts` |
| **Registry** | What services a runtime can create, sent back when it is provisioned. | `hkp-frontend/src/runtime/browser/BrowserRegistry.tsx`, `hkp-node/src/server.ts` |
| **YAS** | The binary wire format for non-textual data over REST — 7-byte header, type-prefixed payload. | `hkp-frontend/src/runtime/rest/Message.ts`, `hkp-python/src/hkp/yas.py` |
| **Remote** | A runtime server the host knows by name. `hkp://remotes/<name>` addresses the app's own embedded runtime. | `meander/backend/remoteRoute.h`, `meander/frontend/src/useBackendRemotes.ts` |

---

## Composition

| Term | What it is | Where it lives |
|---|---|---|
| **Unit** | An ordinary board that also declares what it imports and exports, so another board can be made of it. → `concepts/units.md` | `hkp-frontend/src/runtime/board/units.ts#UnitDeclaration` |
| **Composition** | An ordinary board that lists the units it is assembled from. | `hkp-frontend/src/runtime/board/units.ts#UnitEntry` |
| **Projection** | Assembling composition and units into one board, qualifying exactly one thing: the runtime id. | `hkp-frontend/src/runtime/board/units.ts#projectUnits` |
| **Linkage** | What linking produced, kept while the board is open: the units it was assembled from and the views they contribute. | `hkp-frontend/src/runtime/board/units.ts#BoardLinkage` |
| **Unit origin** | Where a `uri` is looked up — a sibling URL, a file beside the composition, the files opened together, saved boards. There is no registry. | `hkp-frontend/src/core/linkUnits.ts#UnitOrigin` |
| **Unlink** | Splitting a running board back into the documents it came from, as a three-way merge rather than a copy. | `hkp-frontend/src/runtime/board/units.ts#unlinkProjection` |
| **Topic** | The named channel units talk over, since they are never chained to each other. | `docs/content/services/queue.md`, `hkp-node/src/services/queue.ts` |

---

## Deployment and the cloud

| Term | What it is | Where it lives |
|---|---|---|
| **Coordinator** | The instance that owns a board and can see across all its runtimes. → `concepts/coordinator.md` | `hkp-frontend/src/core/coordinator.ts`, `hkp-node/src/coordinator/coordinator.ts` |
| **Cloud board** | A board a coordinator owns and keeps running with nobody watching. → `concepts/cloud-boards.md` | `hkp-node/src/coordinator/session.ts`, `hkp-frontend/src/views/cloud/index.tsx` |
| **Deploy** | Handing a board from the browser that built it to a coordinator. Runtimes are handed over *before* registering. | `hkp-frontend/src/core/deploy.ts#deployBoard` |
| **Bridge** | The WebSocket a browser attaches to a deployed board with — snapshots out, browser-runtime work in. | `hkp-node/src/coordinator/bridgeProtocol.ts`, `hkp-frontend/src/views/cloud/useCoordinatorBridge.ts` |
| **Session token** | The machine credential a coordinator holds per runtime, minted to outlive the user's session. | `hkp-node/src/coordinator/session.ts#mintSessionToken` |
| **Fork** | Copying a deployed board back into something editable; the original keeps running. | `hkp-frontend/src/core/forkBoard.ts` |
| **Mount** | An endpoint a runtime assigns to a service that must be reachable from outside. → `concepts/mounts.md` | `hkp-frontend/src/runtime/board/mount.ts`, `hkp-node/src/mounts.ts` |
| **Mount reference** | `hkp-mount://<runtimeId>/<serviceUuid>` — what a person writes; `__hkpMount` is what machinery fills in. | `hkp-frontend/src/runtime/board/mount.ts#parseMountRef` |

---

## Logging

| Term | What it is | Where it lives |
|---|---|---|
| **Run** | One invocation of a board, followed across every service and runtime it reaches. → `concepts/logging.md` | `hkp-frontend/src/types.ts#ProcessContext`, `hkp-frontend/src/runtime/processContext.ts#startedRun` |
| **Log entry** | One thing worth recording about a run, shaped the same on every runtime. | `hkp-frontend/src/types.ts#LogEntry`, `hkp-rt/lib/include/log_entry.h` |
| **Log store** | Where a board's log lives: one JSONL file per board, kept by the coordinator because only it spans every runtime. | `hkp-node/src/coordinator/logStore.ts` |
| **Log target** | Where a runtime hands its entries — the server registers one per runtime to carry them out. | `hkp-node/src/runtime.ts#registerLogTarget`, `hkp-python/src/hkp/server.py#_send_log` |

---

## Secrets

| Term | What it is | Where it lives |
|---|---|---|
| **Secret reference** | `{{secret.<alias>}}` — stays inline in service state and is resolved at the point of use, so a resolved value never comes back out of `getState`. | `hkp-frontend/src/core/secrets.ts` |
| **Vault** | Where the values actually live, apart from every service's state and reachable only through `secrets()`. | `hkp-node/src/secrets.ts`, `meander/backend/vault.h` |
| **Consent / audience** | Asking before a secret is sent, and to whom it may go; the answer is remembered as a grant. | `hkp-frontend/src/core/secretConsent.ts`, `meander/backend/grants.h` |
| **SecretConsentDialog** | The dialog that does the asking in the desktop app. | `meander/frontend/src/SecretConsentDialog.tsx` |
| **SecretsTab** | Managing secrets in Settings — add, rename, delete. Values are write-only. | `meander/frontend/src/SecretsTab.tsx` |
| **SecretField** | The input a service panel uses for a credential, which shows a reference rather than a value. | `hkp-frontend/src/components/shared/SecretField.tsx` |

---

## The repository

| Term | What it is | Where it lives |
|---|---|---|
| **Superproject** | The outer repository, holding what is built and released together — the frontend, the C++ runtime, the desktop app, these docs. → `repository.md` | `CMakeLists.txt`, `run-all-tests.sh` |
| **Submodule** | One of the five directories with a history and a release of its own: hkp-node, hkp-python, hkp-website, meander-ios, meander-android. A change spanning one and the superproject is two commits. | `.gitmodules`, `scripts/vocabulary.mjs` |

---

## Keeping it true

The risk is not that this is incomplete — it is meant to grow — but that an entry
points somewhere that no longer exists. A wrong reference is worse than a missing
one: it is confidently wrong, and whoever follows it edits the wrong file.

The division of labour:

- **A person decides what belongs here**, what each term means, and which files
  are worth naming. Nothing adds entries automatically.
- **The references are checked against a changeset.** `/vocabulary` (the command
  in `.claude/commands/vocabulary.md`) takes the files a change touched, finds
  every entry that names one of them, and reports which entries a reviewer
  should look at — plus any reference that no longer resolves at all. It
  proposes updated references; it does not invent terms.

Run it on a change big enough to move things around, which is exactly when this
document goes quietly stale.
