# Workflow platform — closing the gap to n8n-class business process boards

Working document for the Synnevents evaluation (Aug 2026) and, beyond it, for making
Readymade a credible home for **stateful, human-in-the-loop business processes** rather
than only interactive apps.

The trigger was a concrete request: a small event agency wants to turn messy hotel
correspondence into structured offer data. That workflow is the forcing function, but
almost every gap it exposes is a general one — the Synnevents board is the first
consumer, not the reason.

**Status legend:** ☐ not started · ◐ in progress · ☑ done · ✎ needs design before build
**Effort legend:** S = under a day · M = 2–4 days · L = 1–2 weeks

---

## Where we stand

| | Gap | Runtime | Effort | Phase | Status |
| --- | --- | --- | --- | --- | --- |
| G1 | `text-generation` with an Anthropic backend | node | M | 0 | ☑ |
| G1b | Tool-use as nested sub-pipelines | node | L | 2 | ✎ |
| G2 | `document-extract` (xberg backend) | node | M | 0 | ☑ |
| G3 | OCR cascade — native text → local OCR → vision | node | S | 1 | ☐ |
| G4 | `store` — durable board-scoped KV | node | M | 0 | ☑ |
| G5 | Control-flow parity (10 services) | node | L | 1 | ☐ |
| G6 | Approval queue — table-backed decoupling | node | L | 2 | ✎ |
| G7 | Board-level logging over the existing bridges | coordinator + runtimes | M | 1 | ✎ |
| G8 | Retry / backoff / dead-letter | node runtime | M | 1 | ☐ |
| G9 | `imap-email` attachments, search, labels | node | S–M | 1 | ☐ |
| G10 | Board as a public page, **read and write** | frontend + coordinator | L | 3 | ✎ |
| G11 | `budget` — token/cost cap that stops a pipeline | node | S | 1 | ☐ |
| G12 | Secret store — secrets never enter service state | node + frontend | M | 1 | ◐ |
| G12b | Replace value-matched redaction on save | frontend | S–M | 1 | ✎ |
| G13 | `baserow` and `missive` services | node | M each | 2 | ☐ |

Everything except G10 and G12's frontend half lands in **hkp-node**. None of it needs C++
or Python — these flows are I/O-bound, not compute-bound.

---

## ⚠ Known constraint until G12 lands

**A board carrying credentials must not be shared, downloaded, or sent through the AI
Refiner.** No stopgap redaction is being shipped — G12 fixes it properly and in one go
(decision below) — so until then this is a documented constraint, not a guarded one.

`serializeBoard()` (`hkp-frontend/src/core/boardPersistence.ts:170`) returns each service's
full state, and four paths consume it:

| Path | Where | Safe? |
| --- | --- | --- |
| Share link — whole board compressed into a URL query param `?fromLink=`, copied to clipboard | `views/playground/BoardLink.ts:12`, called from `ui-components/toolbar/BoardMenu.tsx:77`, `facade/FacadeRenderer.tsx:193`, `views/playground/mobile/MobilePlaygroundInner.tsx:268` | ❌ |
| Download Source → `hkp-board-<name>.json` | `ui-components/toolbar/BoardMenu.tsx:66` | ❌ |
| Refine board with AI → serialized board becomes LLM input | `ui-components/toolbar/BoardMenu.tsx:90` | ❌ |
| Deploy → coordinator | `hkp-node/src/coordinator/fileBoardStore.ts:118` | ✅ deliberate — `0o700` dir, `0o600` file, explicit comment |

The share link is the sharpest edge: URLs get pasted into chat apps, land in browser
history, and query strings are logged by proxies. The AI Refiner is the least visible —
nobody clicking it pictures handing their API keys to a model.

What leaks is inconsistent by service, which is why a heuristic fix was rejected:

| Pattern | Services | Safe? |
| --- | --- | --- |
| Masked write-only field | node `imap-email`, `smtp-email` (`password: ""` + `passwordConfigured`) | ✅ |
| Vault, kept out of state | `OpenAIPrompt` (`_apiKey` is a class field; UI uses `secretId("uservault", …)`), `WorkflowBoardBuilder` | ✅ |
| **Free-form headers in state** | node `http-client` (`headers: this.headers` in `getState`), browser `Fetcher` | ❌ |

Checked Aug 2026: none of the 85 boards in `hkp-frontend/boards/` carry real credentials —
only demo encryption keys. The mechanism is live; nothing has leaked through it yet.

This constraint bites Synnevents hardest: every credential in their stack (Baserow,
Missive, Anthropic, EspoCRM, Places) rides in an `Authorization` or `X-API-Key` header on
`http-client`.

---

## The workflow being served

Strip the specifics and the Synnevents loop is:

```
messy correspondence (email text, PDF, scanned PDF, external link, images)
  → cheap dump (no AI cost at ingest)
  → batched LLM extraction into structured data
  → human checkpoint (review / correct / ask a follow-up question)
  → write to the system of record, read back, verify
  → customer-facing comparison page (a link, printable)
```

Four constraints, all stated by the customer as non-negotiable:

- **C1 — no person-dependency.** A normal employee starts a run; nobody has to kick off
  processing on their own machine or quota. This is the gap they explicitly want closed.
- **C2 — predictable, capped cost.** They got burned once: live per-mail processing came
  to roughly 1 € per mail. Their surviving pattern is *"dump cheaply, process expensively
  only when actually needed"*.
- **C3 — a human control point before every write**, with read-back verification after it.
- **C4 — the schema stays soft.** Per-request custom fields (accessibility, sound-proofed
  room, organic catering) must not require a rebuild.

They keep one truth per fact across Baserow / EspoCRM / Missive and everything else reads.
So Readymade is **orchestration plus UI, never a second data store**. That is a good fit
and it means we do not have to build persistence-as-a-product to win this.

---

## What already maps

Recorded so we do not rebuild it by accident.

| Need | Existing | Runtime |
| --- | --- | --- |
| Webhook in | `http-server-subservices` + mount | node |
| Any REST system (Baserow, Missive, CRM, Places) | `http-client` | node |
| Payload reshaping | `map` (`key=` expression dialect), `expression` | node |
| Scheduled batch run | `timer` (periodic / oneShot) | node |
| Joining a scheduled producer with an ad-hoc consumer | `hold` | node |
| Email in / out | `imap-email` (IDLE), `smtp-email` | node |
| Human checkpoint UI | facade `data-table`, `repeat`, `json-input`, `text-input`, `button`, `status-indicator`, `message-list`, `file-pick` | browser |
| Nested / reusable steps | `sub-service`; `Switch` cases hold pipelines | all |
| **Running with nobody watching** | coordinator + cloud boards + deploy | node |
| Multi-tenancy, write-only secrets, per-tenant quota | `auth.ts`, JWT-namespaced runtimes | node |

Two of these are worth leading with in any pitch, because n8n structurally cannot answer
them:

- **The propose → confirm → write pattern is inversion of control**, already a first-class
  concept here (return `null`, let downstream run, capture the result). They built it by
  hand across two n8n workflows.
- **"Dump cheaply, process expensively" is one board**: `http-server` → `store` → `timer`
  → batch → `text-generation`. In n8n it is two stateless workflows plus a table abused as
  a queue.

---

## Decisions taken

Dated, so we can stop relitigating them.

**2026-08-15 — LLM service reuses `text-generation`, it is not a new service.**
An earlier draft proposed a new `llm-prompt`. Wrong, and against
[TODO-CONSOLIDATION.md](TODO-CONSOLIDATION.md) §1, which sets the rule: one canonical id
per service, bare slugs on backend runtimes, creation-time aliases when an id moves.
hkp-python's `text-generation` already owns the contract — state (`backend`, `serverUrl`,
`model`, `systemPrompt`, `temperature`, `topP`, `topK`, `maxTokens`, `timeoutSec`,
`stream`), output (`{text, thinking?, model, durationMs, usage: {promptTokens,
completionTokens}}`), and an input shape that already admits `{messages: [...]}`. hkp-node
implements the same id with `backend: "anthropic"` and therefore shares the UI panel, the
way `http-client` and `map` already do. hkp-python can gain Claude later by adding the
same backend value.

**2026-08-15 — tool-use lands as nested sub-pipelines, not as JSON tool definitions.**
Each tool the model may call is a sub-service pipeline; a tool call runs that pipeline and
its result is returned as `tool_result`. So "write a row to Baserow" is literally an
`http-client` inside a sub-service — observable, testable on its own, and composable.
This is the design principle in CLAUDE.md ("complexity lives in composition") and it is
the thing n8n cannot answer. It also turns the customer's propose/confirm/verify
discipline into *board structure* rather than prompt discipline.

**2026-08-15 — control flow gets ported to node, not bridged from the browser.**
A board deployed to the coordinator runs headless and cannot reach browser services, so
C1 and control flow are currently in direct conflict. Close the gap rather than work
around it.

**2026-08-15 — `document-extract` uses xberg, behind an optional dependency.**
Verified: MIT, Rust core, napi prebuilt binaries for 6 targets (no Rust toolchain at
install), zero runtime dependencies, node ≥ 22, 100+ formats including DOCX/XLSX/archives/
email, plus table extraction and layout detection. Two caveats drove the shape:
its platform binaries are ~150 MB each, so it must not be a hard dependency of a lean
published `hkp-node`; and it is very new (1.0.0 on 2026-07-28, 1.0.14 on 2026-08-05), so
the service carries a `backend` state (`xberg` | `builtin`) from day one and can be
swapped without touching any board. Registration is conditional on the module resolving —
the same pattern hkp-python already uses for its `[asr]` / `[llm]` / `[tts]` extras.

**2026-08-15 — logging is its own service, not a `monitor` mode.**
`monitor` is a zero-config debug probe whose value is being cheap to drop in anywhere and
showing everything. A log is a sink with policy: severity, redaction, retention, query.
Putting redaction config on `monitor` makes every debug probe carry PII policy, and a
redacting monitor versus a non-redacting one is two contracts on one service id — the
exact failure TODO-CONSOLIDATION §1 calls the worst kind. `monitor` does gain one slim
addition: an **"also log this"** flag, so probes already placed feed the run history for
free.

**2026-08-15 — the approval queue starts Synnevents-specific and grows into a feature.**
Built first as a board pattern over `store` (G4) plus a facade table, extracted into a
service once a second consumer exists. Deliberately not over-built in phase 2.

**2026-08-15 — secrets are fixed once, by G12, with no stopgap.**
Options considered: (1) redact by header-name heuristic at serialize time — rejected,
heuristics miss and fail *silently*, the worst property for a secret, and they break the
receiving board with no explanation; (3) descriptors declare which state fields are
secret — better, but `headers` is a map whose secret-ness is per-key, so `http-client`
still needs special handling. Chosen: **(2) secrets never enter service state.** Service
state holds a reference (`{{secret.baserowToken}}`); the value lives outside the board and
is resolved at configure time inside the runtime, so it never reaches a client.
Serialization is then safe *by construction* — there is nothing to redact because the
state never held it. Until it lands, the constraint above is documented rather than
enforced.

**2026-08-23 — G12's frontend half shipped; `redactSecrets` is a stopgap to be replaced (G12b).**
`{{secret.<alias>}}` references, both passes, and a `SecretStore` interface live in
`hkp-frontend/src/core/secrets.ts`; the desktop app resolves them from `~/.hkp/vault.json`
(`meander/backend/vault.h`, `0600`, **not encrypted**) via a Secrets tab in the settings
dialog. Resolution happens in `restoreBoard`, so it covers every runtime type and reaches
browser services and the no-backend playground — which runtime-side resolution never
could.

Resolving in a client is what creates the need to redact on the way out, and the shipped
redaction **matches on the secret's value**: `serializeBoard` scans the serialized state
for any stored value and writes the reference back in its place. It is the reason a board
can be saved again without leaking, and it is the part to reconsider.

Why it is there at all: `getState` is not consistent about credentials. `imap-email` and
`smtp-email` mask theirs (`password: ""`), so nothing survives the round-trip and nothing
needs redacting — the reference is simply lost and retyped, which is the accepted
behaviour. But `http-client` reports `headers` verbatim (`http-client.ts:106`), so a
resolved `Authorization` header would be written into the board on the next save. That is
the case G12 exists for: every Synnevents credential rides in a header.

What is wrong with matching on value:

- A short or ordinary secret rewrites unrelated text anywhere in the board. Real tokens
  are long and high-entropy, so it should not bite — but the failure is silent and
  corrupts a board rather than leaking one.
- It infers intent from a coincidence of strings. A field that happens to equal a secret
  is redacted whether or not it ever was one.
- The board is scanned in full on every save, so cost grows with board size × secrets held.

Options for G12b, none chosen:

1. **Make `http-client` mask its headers per key**, the way `imap-email` masks its
   password. Redaction then has no remaining caller and is deleted. Rejected once (see
   2026-08-15) on the grounds that per-key secret-ness needs special handling — but that
   objection was about *declaring* which keys are secret, and a header whose value was
   resolved from a reference is already known to be one.
2. **Keep the reference in service state and resolve at request time.** The service holds
   `{{secret.x}}`, `getState` reports it unchanged, and nothing needs putting back.
   Scoped to `http-client` this is small; as a general rule it makes every service that
   takes a credential responsible for resolving one.
3. **Runtime-side resolution** — the other half of the decision already taken. When
   hkp-node resolves references itself, a resolved secret never reaches a client, board
   state never holds one, and redaction is unnecessary by construction. This is the
   endpoint; 1 or 2 is what closes the gap until then.

**2026-08-15 — board-level logging rides the existing sockets; no new REST ingestion.**
The coordinator already holds a persistent authenticated WebSocket **per provisioned
runtime** (`session.ts:441`, `sockets: runtimeId → WebSocket`), opened with a per-runtime
**session token it minted itself** — explicitly for "long-lived machine calls that outlive
the user's JWT" (`session.ts:49`). That is exactly the credential a headless log stream
needs, and a new REST endpoint would have to re-solve it *worse*: either reusing the
user's JWT, which expires while the board keeps running, or minting a third credential.
The coordinator also **drives the chain itself** — `bridgeProtocol.ts:92` states that
routing one runtime's result to the next "is the coordinator's own job" — so the
board-level skeleton (which runtime ran when, with what outcome) needs *no service
cooperation at all*. Services only enrich a trace the coordinator already has.

**2026-08-15 — reading history is a REST route guarded by the user JWT.**
Ingestion stays on the sockets (above); reading is the opposite verb with opposite needs
and gets a route. A filesystem-only option was considered and rejected: it left the
run-history gap against n8n wide open, which is the one operational feature that gap
analysis kept identifying as the reason people tolerate n8n at all.

Auth needs no new mechanism. `router.ts:21` already puts every board route behind
`router.use("/users/:username", auth, requireSelf)` — a valid token *and* `sub` matching
the username path param (`coordinator/auth.ts:23`). The log route slots in beneath it and
inherits both, with the same per-user namespacing `fileBoardStore` enforces on disk.

Explicitly **not** the per-runtime session token. That is a machine credential, minted per
runtime and deliberately long-lived so it outlives the user's JWT; letting it read board
history would widen its blast radius from "push frames for my own runtime" to "read
everything this board ever logged". The two credential classes stay separate: **session
tokens push, user JWTs read.**

---

## Open questions

**Blocking**

1. **Run-id attribution inside a runtime** (see G7). Independent of transport, and
   unresolved.

**Non-blocking**

2. Should the runtime report run completion (`run <id> ended, with this outcome`)? Nothing
   does today, which is why `store`'s ack has to be placed by hand and why a failure
   cannot be told from a slow run. It would serve retry (G8), dead-lettering, board
   health, and would let a service host work as a sub-pipeline and know whether it
   succeeded. Raised 2026-08-16 and deferred by decision — the ack covers phase 0.
3. Should `budget` (G11) cap per board, per tenant, or both? Per-tenant quota machinery
   already exists in `auth.ts` and may partly cover this.
4. xberg also does Whisper audio transcription, which overlaps `speech-to-text` in
   hkp-python and hkp-rt. Not a conflict today — just do not route audio through
   `document-extract`.

**Resolved**

- ~~Is board-as-public-page a Readymade feature?~~ Yes — see G10, and it grew in scope.
- ~~Where does the execution record live, runtime or board level?~~ Board level, owned by
  the coordinator — see G7.
- ~~Does deploy/export strip secrets?~~ No. Verified, documented above, fixed by G12.
- ~~Is there a REST read path for log history?~~ Yes, and it is guarded by the existing
  `auth` + `requireSelf` board-route middleware, not by the runtime session token — see G7.
- ~~Design for log/data contention on the shared socket?~~ Not now — deferred until
  measured, see G7.

---

## Phase 0 — the loop, end to end

Goal: one deployed board that demonstrates C1–C4 on a single real offer email. This is the
demo that decides whether the customer engages at all, so it favours breadth over depth.

- ☑ **G1 — `text-generation`, Anthropic backend.** Done 2026-08-15.
  `hkp-node/src/services/text-generation.ts` — same service id, state contract and output
  shape as hkp-python's, so the UI panel and any board move across unchanged. Messages
  array in, system prompt as a parameter, `jsonSchema` (sent as a forced tool, parsed
  object emitted as `json`), images from `{meta, binary}` or `{images: [...]}`, streaming
  as `{streamText}`, `thinking`, and `usage` in the shared shape. The key is write-only and
  falls back to `ANTHROPIC_API_KEY` in the runtime's environment — which is how a deployed
  board avoids carrying one at all, and the answer to the ⚠ constraint for this service.
  Answers are pushed, not returned (the `http-client` inversion-of-control path), because
  generation outlives the pass that started it. No tool-use yet — that is G1b.
  `hkp-node/tests/text-generation.test.ts` (19), demo board
  `text-generation-anthropic-demo-board.json`, docs page extended.
- ☑ **G2 — `document-extract`.** Done 2026-08-15.
  `hkp-node/src/services/document-extract.ts`, `backend` state (`xberg` | `builtin`) from
  the start. Emits `{text, chars, pages, charsPerPage, sparse, method, format, backend,
  durationMs, truncated?, textCoverage?, confidence?, metadata?, tables?}`.
  `hkp-node/tests/document-extract.test.ts` (20), demo board
  `document-extract-demo-board.json`, docs page `docs/content/services/document-extract.md`.

  Three things the decision above got wrong or left open, settled by building it:

  - **The package is `@xberg-io/xberg`, not `xberg`** — the bare name is not on npm. Its
    API is `extract({kind:"bytes", bytes, mimeType?, filename?}, config)` →
    `{results: [{content, mimeType, counts:{pages}, extractionMethod,
    extractionConfidence:{textCoverage, combined}, tables, metadata}], errors}`.
  - **Registration is not conditional after all.** It was going to be, but `builtin` is a
    real backend (text/HTML/JSON/CSV, no dependency), so hiding the whole service when the
    optional package is absent would remove something that works. The dependency is absent
    from `package.json` entirely, resolved by dynamic import, and reported with an install
    hint when missing.
  - **OCR is on by default, and `sparse` marks what even OCR could not read.** An earlier
    version of this entry had OCR off on the grounds that it "costs money". That was
    wrong: xberg's OCR engines run locally, so a scanned page costs CPU and nothing else,
    and refusing to read one just hands back an empty document. `ocr` is now
    `auto` (default) | `off` | `force`, mapping to the library's own
    `disableOcr` / `forceOcr`, with `ocrBackend` and `ocrLanguage` passed through.
    `sparse` therefore means something stronger than before — *a local engine could not
    read these pages either* — which is exactly the point at which paying is justified.
    It prefers the backend's `textCoverage` over character density, because density cannot
    see which pages produced text.
- ☑ **G4 — `store`.** Done 2026-08-15. `hkp-node/src/services/store.ts` over
  `services/recordStore.ts`, which follows `coordinator/fileBoardStore.ts` exactly:
  derived path names, tmp-then-rename, `0o700`/`0o600`. Five modes (put/get/list/delete/
  clear); a `get` miss returns nothing and stops the pipeline, which is what makes
  look-up-then-fetch two services rather than a branch. `HKP_STORE_DIR` moves it,
  `HKP_STORE_DIR=""` keeps records in memory. `hkp-node/tests/store.test.ts` (23), demo
  board `store-demo-board.json`, docs page `docs/content/services/store.md`.

  **Prerequisite built with it: runtimes now know their tenant and board.**
  `RuntimeHost.scope()` returns `{owner, boardName}`; `RuntimeApp` passes the owner key it
  already resolves into `HostedRuntime`, and `sub-service` hands its scope down to a nested
  pipeline the same way it already hands down log settings. Without this a service could
  not namespace anything durable — it is told its own configuration and nothing about who
  asked for it — and one tenant's records would land in another's. Anything stateful after
  this (G6's approval queue, G12's secret store) needs the same seam.
- ◐ **Demo board.** `offer-intake-demo-board.json` — the loop, end to end, minus the
  customer-specific ends. Webhook → `store` (put) → a facade table of what is waiting →
  a person ticks rows → `store` (release) → `document-extract` → `text-generation` with a
  `jsonSchema` → monitor. Their sidebar posts to the mount instead of an n8n webhook,
  which needs no work on our side.

  **The human checkpoint, built the cheap way (2026-08-16).** No approval service and no
  new widget: `data-table` gained row selection, and `store` gained a `release` mode.
  - A table notification carrying an **array** now replaces the table rather than
    appending — appending a queue on every read would show every item once per read.
    An object still appends, so existing log-style tables are unchanged. Replace-mode
    tables also stop auto-jumping to the last page, which would take somebody working
    through a queue away from the page they were reading.
  - `selectable` writes the picked rows into facade state; an ordinary `button` sends
    them on with `{"keys": {"$state": "picked"}}`, using the `$state` resolution that
    already existed in `executeActions.ts`.
  - `release` acts **on configure**, because a facade button can only configure a
    service — the same shape Timer uses for `start: true`. `keys` is kept out of
    `getState` so a saved board cannot re-release on open.
  - Select-all covers the page in view, not the whole buffer.

  **Approval is no longer final (2026-08-16).** A released record is *leased*, not
  deleted: it leaves the queue but stays on disk until a `store` in `ack` mode, placed
  where the board says success is, settles it. Anything that never reaches the ack stays
  in flight — visible via `list` with `show: "in-flight"`, returned with `requeue`.

  The problem this had to solve is worth recording, because it will come back for every
  other "did that work?" question: **the pipeline cannot report its own outcome.** A
  service that answers late (`text-generation`, `http-client`) returns `null` from its
  pass, so success and failure are indistinguishable to whatever called it. Three designs
  were considered — an explicit ack, hosting the work as a sub-service and watching its
  result, and a real run-completion signal on the runtime. Sub-services were rejected:
  `emitResult` carries no run identity, so with several records in flight nothing says
  which result belongs to which. The run-completion signal is the right long-term answer
  and is deferred (see the open question below).

  What made the ack workable without board bookkeeping is that `ProcessContext.runId`
  *does* survive the async gap — services capture it and hand it back to `processFrom`.
  So `release` mints a run per record and writes it onto the lease, and `ack` settles
  whatever record its own run is carrying. The record's key never has to be carried
  through the pipeline, which the services in between would drop anyway.

  There is deliberately **no lease timeout**: a stranded record waits for a person, which
  suits a board whose whole point is a human checkpoint. Add one when boards run with
  nobody looking at the in-flight table.

  Still open before this is a customer demo: `http-client` writing Baserow and the
  read-back diff (needs their schema and a credential — see the ⚠ constraint).

The demo board is the deliverable, not the services. Their sidebar stays their sidebar; it
posts to a mount instead of an n8n webhook, which needs no work on our side.

**Handle credentials by the constraint above** — this board will carry five of them.

---

## Phase 1 — production-credible

Goal: a board that can be trusted with real correspondence unattended.

- ✎ **G12 — secret store.** Moved up from phase 2: phase 0's demo board carries five
  credentials and the AI Refiner is one click away. Same idea as
  `meander/backend/vault.h`, but explicitly **not a port of it** — that one is flat
  plaintext JSON at `~/.hkp/vault.json` injected wholesale into the webview as
  `window.__HKP_VAULT__` (`meander/backend/main.cpp:242`), with namespacing by convention
  only (`hkp-frontend/src/vault.ts`). Both properties are wrong for a multi-tenant server.
  The node store must be per-`sub` namespaced, encrypted at rest, referenced from service
  state by indirection, and resolved at configure time inside the runtime. Keep the
  existing write-only-field UX (the `passwordConfigured` boolean pattern). Effort M.
- ☐ **G5 — control-flow parity.** Port `switch`, `if`, `filter`, `select`, `sort`,
  `group-by`, `flat-map`, `batch`, `limit`, `cache` to node against the existing
  `hkp-node/src/services/expression.ts`. Extend the board-loading test proposed in
  TODO-CONSOLIDATION §1 (load every board in `hkp-frontend/boards/`, assert each
  non-browser `serviceId` resolves in that runtime's registry) to cover the parity set.
  Effort L.
- ☐ **G3 — OCR cascade.** Mostly built already, and smaller than this entry assumed.
  G2 covers the first two tiers: native text layer, then local OCR, both inside
  `document-extract` and both free of per-page cost. What remains is the third tier and
  it is **configuration, not a new service** — xberg implements it internally as
  `ocr.vlmFallback: {mode: "disabled" | "on_low_quality", qualityThreshold} | {mode: "always"}`
  plus `ocr.vlmConfig` (an `LlmConfig`), so escalation to a vision model is a few state
  fields on the service that already exists. Two ways to expose it, to be decided when
  built: hand it to xberg (one service, one call, the library picks per page) or branch in
  the board on `sparse` into a `text-generation` with the page images (visible in the
  board, costs a `switch` from G5, and reuses G1's vision support). The first is simpler;
  the second is the one a board creator can see and cap.
  Be honest in any pitch: the customer's worst documents (bad faxed scans) are exactly
  where local OCR is weakest. The claim is *"most documents cost nothing, the hard ones
  cost a known, capped amount"* — not *"free"*.
  Engine note for deployment: `tesseract` is the one engine that is **not** bundled (system
  install plus language packs); `paddleocr`/`sceptre`/`candle-*` download weights from
  Hugging Face on first use, so the first document through a cold runtime is slow.
- ☐ **G8 — retry / backoff / dead-letter.** There is nothing today: a flaky Baserow call
  loses data silently. Decide between a runtime-level policy and a `retry` sub-service
  wrapper. Effort M.
- ☐ **G9 — `imap-email`.** Attachments (`imap-email.ts` currently parses text only and
  drops them), fetch-by-id and search, label/flag writing. The customer's own plan for a
  dedicated mailbox with dedicated labels depends entirely on this. Effort S–M.
- ☐ **G11 — `budget`.** Reads the `usage` G1 reports, stops the pipeline over a cap,
  surfaces spend in the facade. This is the concrete answer to "what does cost control
  look like". Effort S.
- ✎ **G7 — board-level logging.** Design below. Effort M.

### G7 design

**The coordinator owns the log**, because it is already the only instance with a view of
the whole board, and because it already drives the chain — so the skeleton of every run
(which runtime, when, with what outcome) is knowable without asking any service.

**Ingestion rides the sockets that already exist**, per the decision above. Two protocols,
two additions, mirroring exactly how `notification` already flows:

- **runtime → coordinator**, on the per-runtime session-token socket (`session.ts:441`):
  a `log` frame beside the existing `notification` frame.
- **coordinator → browser**, on the bridge (`bridgeProtocol.ts`): a `log` frame forwarded
  for live display, beside `notification`. Same rationale the file already gives for
  keeping `notification` apart from `serviceState`: they are different things.

Entry shape, shared by both hops:

```
{ runId, parentRunId, ts, runtimeId, serviceUuid, level, event, data?, durationMs? }
```

**`parentRunId` is required, not reserved** (decided 2026-08-15). A run stops being a line
the moment sub-services exist — `sub-service`, `http-server-subservices` handlers, `Switch`
cases — and **G1b makes every tool call a nested pipeline**. With a flat id, the outer
pipeline and everything inside every nested one share one id: the log can say the entries
belong to one run but not how they nest, so a Switch with three cases plus a tool-use loop
is 40 entries in timestamp order with no structure. Since the point of G1b is that a tool
call is an inspectable pipeline, a log that cannot show *"the model called this tool, which
ran these three services"* misses the feature it exists to support — and tool calls
interleave, because a loop makes several per turn.

Each nested invocation mints its own `runId` and records the one it was invoked from, so a
reader rebuilds the tree:

```
run A  (webhook)
├─ document-extract
├─ text-generation
│   ├─ run B  parent=A   (tool: baserow-lookup) → http-client
│   └─ run C  parent=A   (tool: write-row)      → http-client
└─ monitor
```

This is trace/span in miniature (`runId` ≈ trace id). Deliberately *not* a full span model
— the parent link is most of the value for nesting at a fraction of the complexity.
hkp-rt corroborates that nesting needs tracking at all: its `ProcessDepth` counter
(renamed from `ProcessContext`, TODO-CONSOLIDATION §4) exists because the runtime cannot
otherwise tell when a run is finished.

Service-facing, on `RuntimeHost` beside the existing `notify`:

```ts
host.log(level, event, data?)   // runId + serviceUuid implicit from the active run
```

One critical difference from `notify`: **notifications may be dropped when nobody is
watching; log entries must survive with nobody attached.** That is precisely the headless
C1 case, and it is why the coordinator (not the browser bridge) is the sink.

**Storage — JSONL, written by the coordinator:**

- **JSONL — one entry per line.** Greppable, appendable without rewriting, and a crash
  mid-write costs the last line rather than the file. A pretty-printed JSON array would
  have to be rewritten on every append. It also streams to the read route without loading
  the file.
- **One log per board**, containing entries from *every* runtime — that stitching is the
  whole point of logging at board level. Runtimes never write their own files; they send
  frames.
- **Beside the board store**, reusing `fileBoardStore`'s per-user directories and its
  `0o700` / `0o600` modes. Log entries carry board data, so they inherit the same
  multi-tenant namespacing and the same "owner's to read, nobody else's" property.
- **Rotation with a retention cap.** A headless board running for months grows the file
  unbounded. Doubles as PII exposure limiting — see below.

**Reading — REST, under the existing board-route auth:**

```
GET /users/:username/boards/:boardName/runs           // run list
GET /users/:username/boards/:boardName/runs/:runId    // one run, all runtimes
    ?level=&since=&limit=&fields=
```

Guarded by `router.use("/users/:username", auth, requireSelf)` (`router.ts:21`) — valid
token plus `sub` matching the username. No new auth mechanism, and **not** the per-runtime
session token (see the decision above).

**PII containment.** Redaction at source is a discipline, and disciplines fail — a service
*will* eventually log something it should not. So redaction is the last layer, not the
first:

- **`data` is opt-in, default off.** Look at the entry shape: `runId`, `parentRunId`, `ts`,
  `runtimeId`, `serviceUuid`, `level`, `durationMs` are structural and carry no PII risk;
  `event` is a
  service-authored string, bounded and low-risk. **Essentially all PII risk lives in the
  free-form `data` payload.** Making that one field opt-in per board means a service that
  forgets to redact can only leak through a channel somebody deliberately enabled. It
  converts the failure mode from silent to opted-into — and it drops the bulky field,
  which incidentally relieves the shared-socket contention noted below.
- **Filtering is server-side.** If the route returned everything and a UI filtered it,
  `data` crossed the wire regardless. The route must be able to serve entries *without*
  `data` even when it is on disk — hence `fields=` alongside `level=`.
- **The log is owner-only and never follows a share.** The frontend has
  `shareBoard` / `joinBoard`; if sharing a board ever granted log access, one forgotten
  redaction becomes a cross-tenant leak. Cheap to state now, expensive to retrofit.
- **Retention caps the exposure window**, on top of capping disk.

**Still to decide:**

- **Run-id attribution inside a runtime.** The carrier is decided: `runId` rides in
  `ProcessContext`, beside the existing `requestId` and never merged with it — see
  [TODO-CONSOLIDATION.md](TODO-CONSOLIDATION.md) §4, which owns promoting that type to a
  cross-runtime concept. **G7 starts that work.**

  Note the earlier framing here was wrong on one point: `processFromIndex` is a
  synchronous `for` loop (`hkp-node/src/runtime.ts:223`) and node is single-threaded, so
  two runs *cannot* interleave inside a pass. The ambiguity is only about runs that
  **resume or start outside a pass**, and those are exactly the 8 `processFrom` call sites
  (`http-client`, `http-server`, `imap-email`, `timer`, `telegram-listener`, `peer-server`,
  `map`). Continuation callers pass the id they captured; autonomous roots pass nothing and
  the runtime mints one. Everything else reads it ambiently from the runtime, so no service
  signature changes.

  Failure mode is benign and that is the point: a caller that forgets to pass the id mints
  a new one, so a trace **fragments into two runs rather than misattributing to one**.
  Fragmentation is visible; misattribution is silently wrong.
- **Redaction happens at source, not at the coordinator.** If a runtime ships raw data and
  the coordinator redacts, the secret already crossed the wire. The runtime redacts, from
  policy the coordinator pushes down at load time — making log policy part of board config.

**Stated properties, not bugs:**

- **Playground boards have no run history.** In the playground the browser *is* the
  coordinator, so there is no filesystem to write to — history is a cloud-board feature,
  and the playground gets the live stream only. Documented here so it does not arrive
  later as a bug report.
- **Log frames share the wire with runtime results**, so a board processing 500 offers has
  logging competing with its own data. Deliberately **not** designed around now: batching,
  caps and frame priority are all available if it ever proves to be a bottleneck, and that
  call should be made on measurements rather than on an assumed load.

---

## Phase 2 — the differentiators

Goal: the things that make Readymade the *right* tool rather than an adequate one.

- ✎ **G1b — tool-use as sub-pipelines.** Per the decision above. Ship G1's wire format
  first and grow into this. Effort L.
- ✎ **G6 — approval queue.** Table-backed decoupling: everything awaiting a human collects
  in one place, the flow continues when it is released. Built over `store` (G4) plus a
  facade inbox; extracted into a service once a second consumer exists. This is the
  missing *concept* — today a board is a pipeline with no first-class notion of a parked,
  resumable work item — and it is where n8n is weakest. Effort L.
  **Shares its core widget with G10 — see the coupling note there.**
- ☐ **G13 — `baserow` and `missive` services.** `http-client` covers both on day one;
  wrapping them buys schema introspection (which serves C4 directly), batch upsert,
  filtered list, attachment fetch, comments and labels. Effort M each.

---

## Phase 3 — board as a product surface

### G10 — public board pages, read **and** write

Decided (2026-08-15) to be a **Readymade feature**, not a Synnevents deliverable. Pushing
on the human-AI-collaboration framing grew it past a page renderer.

The customer's section 4 is output-only: a client reads a comparison. But their section 5
pain contains the two-way case — they need to ask hotels follow-up questions and collect
answers, which today is email ping-pong returning as unstructured prose, the exact thing
they are trying to escape.

So the feature is **"publish a board as a page that can send structured data back into the
board"**, because *the cheapest way to get structured data out of a hotel is not to parse
their prose at all — it is to hand them three fields.* That shrinks the extraction problem
rather than solving it.

And the natural widget is not a form but a **diff/confirm view**: *"here is what we read
from your email; correct anything wrong."* The model proposes; a human outside the
organisation corrects it, structurally. That is the human-AI collaboration loop Readymade
exists for, pointed at someone without an account.

**Coupling note — this is the same widget as G6.** The internal approval checkpoint and
the external correction page are one propose-and-confirm surface, pointed inward and
outward. G6 sits in phase 2 and G10 in phase 3; building them two phases apart means
building it twice. **Pull the shared widget design forward and let both consume it.**

Approach, decided:

| | Approach | Effort | Assessment |
| --- | --- | --- | --- |
| A | `html-template` service on an `http-server` mount | M | Cheap, but not a facade — a parallel rendering stack with zero widget reuse. Architectural dead end. Proposed then withdrawn. |
| B | **Public facade route** `/view/<unguessable-id>`, coordinator-served, URL params bound into service state | L | Reuses `data-table`, `repeat`, `line-chart` and the rest. Chosen. |
| C | B plus a `html` / `rich-text` facade widget | L+ | Covers the free-layout gap that drove them off Baserow's app builder. Likely follow-on. |

**Design questions**

- **Identity without accounts.** The unguessable-URL model (the mount precedent) works for
  a link sent to one recipient. But "who submitted this" matters once two hotels hold
  links. Answer: **per-recipient links, minted per request — the URL *is* the identity.**
  That fits their per-request model exactly. Needs deciding where minted links live and
  how they map back to a request.
- **Write authorization is per widget, not per board.** A public page that can configure
  services is a public write into a board. Needs a whitelist: which widgets may write,
  into which services, with what payload shape. A board-wide read-only flag is too coarse
  to express "this hotel may correct its own price and nothing else".
- **Expiry and revocation.** An offer link should die — on a deadline, on the offer being
  accepted, or on demand.
- **Print is not a detail.** Their Baserow prototype died on browser print cutting off
  wide tables. Real print CSS — page breaks, repeating table headers, no viewport-width
  assumptions — or we reproduce their bug exactly.
- **Serving path must not leak the rest of the board.** A public view of one facade panel
  must not expose the board's other runtimes, services, or state.

---

## Positioning — where n8n is still ahead

For honesty in any pitch, and because these are the things a prospect will raise.

- **Integration count.** n8n has hundreds of nodes; hkp-node has eight services plus
  `http-client`. For this workflow it barely matters — every system involved is REST — but
  do not claim breadth we do not have.
- **Run history.** n8n's execution log is its best operational feature and a large part of
  why people tolerate it. Before G7, debugging a failed run means watching `monitor` output
  live. G7 closes most of this: a durable per-board log, queryable per run across every
  runtime. What it does not ship is n8n's *visual* re-execution view — inspecting a past
  run node by node and replaying it. Data parity, not UI parity.
- **Board versioning and staging.** Nothing beyond deploy today.

The pitch is not "replace n8n". It is: **the part of their process that is a stateful,
human-in-the-loop, cost-shaped app is the part n8n is worst at, and it is the part they
have labelled completely open.** Stateless webhook chains can stay where they are.
