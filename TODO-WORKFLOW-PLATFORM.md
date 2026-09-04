# Workflow platform — closing the gap to n8n-class business process boards

Working document for the SYN evaluation (Aug 2026) and, beyond it, for making
Readymade a credible home for **stateful, human-in-the-loop business processes** rather
than only interactive apps.

The trigger was a concrete request: a small event agency wants to turn messy hotel
correspondence into structured offer data. That workflow is the forcing function, but
almost every gap it exposes is a general one — the SYN board is the first
consumer, not the reason.

**Status legend:** ☐ not started · ◐ in progress · ☑ done · ✎ needs design before build
**Effort legend:** S = under a day · M = 2–4 days · L = 1–2 weeks

---

## Where we stand

|      | Gap                                                                       | Runtime                | Effort | Phase | Status |
| ---- | ------------------------------------------------------------------------- | ---------------------- | ------ | ----- | ------ |
| G1   | `text-generation` with an Anthropic backend                               | node                   | M      | 0     | ☑      |
| G1b  | Tool-use as nested sub-pipelines                                          | node                   | L      | 2     | ✎      |
| G2   | `document-extract` (xberg backend)                                        | node                   | M      | 0     | ☑      |
| G3   | OCR cascade — native text → local OCR → vision                            | node                   | S      | 1     | ☐      |
| G4   | `store` — durable board-scoped KV                                         | node                   | M      | 0     | ☑      |
| G5   | Control-flow parity (10 services)                                         | node                   | L      | 1     | ☐      |
| G6   | Approval queue — table-backed decoupling                                  | node                   | L      | 2     | ✎      |
| G7   | Board-level logging over the existing bridges                             | coordinator + runtimes | M      | 1     | ✎      |
| G8   | Retry / backoff / dead-letter                                             | node runtime           | M      | 1     | ☐      |
| G9   | `imap-email` attachments, search, labels                                  | node                   | S–M    | 1     | ☐      |
| G10  | Board as a public page, **read and write**                                | frontend + coordinator | L      | 3     | ✎      |
| G11  | `budget` — token/cost cap that stops a pipeline                           | node                   | S      | 1     | ☐      |
| G12  | Secret store — secrets never enter service state                          | node + frontend        | M      | 1     | ◐      |
| G12b | Replace value-matched redaction on save — **see TODO-SECRETS.md**         | all runtimes           | L      | 1     | ✎      |
| G13  | `baserow` and `missive` services                                          | node                   | M each | 2     | ☐      |
| G14  | Split and re-join — carry context past a service that replaces its output | node                   | M      | 1     | ✎      |
| G15  | Expressions must not be arbitrary JavaScript in the runtime process       | node                   | S      | 0     | ☑      |
| G16  | `iterator` — iteration as a service, not inside one                       | node                   | S      | 0     | ☑      |
| G14b | Re-join an **asynchronous** detour — the pipeline awaits its services     | node runtime           | M      | 1     | ☑      |
| G17  | `communication-dispatcher` — one manager, many actions, model-decided     | node + frontend        | M      | 0     | ☑      |
| G18  | An approved reply is never sent — no outbound leg at all                  | node                   | M      | 0     | ☑      |

Everything except G10 and G12's frontend half lands in **hkp-node**. None of it needs C++
or Python — these flows are I/O-bound, not compute-bound.

---

## ⚠ Known constraint until G12 lands

**A board carrying credentials must not be shared, downloaded, or sent through the AI
Refiner.** No stopgap redaction is being shipped — G12 fixes it properly and in one go
(decision below) — so until then this is a documented constraint, not a guarded one.

`serializeBoard()` (`hkp-frontend/src/core/boardPersistence.ts:170`) returns each service's
full state, and four paths consume it:

| Path                                                                                         | Where                                                                                                                                                                              | Safe?                                                       |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Share link — whole board compressed into a URL query param `?fromLink=`, copied to clipboard | `views/playground/BoardLink.ts:12`, called from `ui-components/toolbar/BoardMenu.tsx:77`, `facade/FacadeRenderer.tsx:193`, `views/playground/mobile/MobilePlaygroundInner.tsx:268` | ❌                                                          |
| Download Source → `hkp-board-<name>.json`                                                    | `ui-components/toolbar/BoardMenu.tsx:66`                                                                                                                                           | ❌                                                          |
| Refine board with AI → serialized board becomes LLM input                                    | `ui-components/toolbar/BoardMenu.tsx:90`                                                                                                                                           | ❌                                                          |
| Deploy → coordinator                                                                         | `hkp-node/src/coordinator/fileBoardStore.ts:118`                                                                                                                                   | ✅ deliberate — `0o700` dir, `0o600` file, explicit comment |

The share link is the sharpest edge: URLs get pasted into chat apps, land in browser
history, and query strings are logged by proxies. The AI Refiner is the least visible —
nobody clicking it pictures handing their API keys to a model.

What leaks is inconsistent by service, which is why a heuristic fix was rejected:

| Pattern                        | Services                                                                                                | Safe? |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- | ----- |
| Masked write-only field        | node `imap-email`, `smtp-email` (`password: ""` + `passwordConfigured`)                                 | ✅    |
| Vault, kept out of state       | `OpenAIPrompt` (`_apiKey` is a class field; UI uses `secretId("uservault", …)`), `WorkflowBoardBuilder` | ✅    |
| **Free-form headers in state** | node `http-client` (`headers: this.headers` in `getState`), browser `Fetcher`                           | ❌    |

Checked Aug 2026: none of the 85 boards in `hkp-frontend/boards/` carry real credentials —
only demo encryption keys. The mechanism is live; nothing has leaked through it yet.

This constraint bites SYN hardest: every credential in their stack (Baserow,
Missive, Anthropic, EspoCRM, Places) rides in an `Authorization` or `X-API-Key` header on
`http-client`.

---

## The workflow being served

Strip the specifics and the SYN loop is:

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
  to roughly 1 € per mail. Their surviving pattern is _"dump cheaply, process expensively
  only when actually needed"_.
- **C3 — a human control point before every write**, with read-back verification after it.
- **C4 — the schema stays soft.** Per-request custom fields (accessibility, sound-proofed
  room, organic catering) must not require a rebuild.

They keep one truth per fact across Baserow / EspoCRM / Missive and everything else reads.
So Readymade is **orchestration plus UI, never a second data store**. That is a good fit
and it means we do not have to build persistence-as-a-product to win this.

---

## What already maps

Recorded so we do not rebuild it by accident.

| Need                                                 | Existing                                                                                                             | Runtime |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------- |
| Webhook in                                           | `http-server-subservices` + mount                                                                                    | node    |
| Any REST system (Baserow, Missive, CRM, Places)      | `http-client`                                                                                                        | node    |
| Payload reshaping                                    | `map` (`key=` expression dialect), `expression`                                                                      | node    |
| Scheduled batch run                                  | `timer` (periodic / oneShot)                                                                                         | node    |
| Joining a scheduled producer with an ad-hoc consumer | `hold`                                                                                                               | node    |
| Email in / out                                       | `imap-email` (IDLE), `smtp-email`                                                                                    | node    |
| Human checkpoint UI                                  | facade `data-table`, `repeat`, `json-input`, `text-input`, `button`, `status-indicator`, `message-list`, `file-pick` | browser |
| Nested / reusable steps                              | `sub-service`; `Switch` cases hold pipelines                                                                         | all     |
| **Running with nobody watching**                     | coordinator + cloud boards + deploy                                                                                  | node    |
| Multi-tenancy, write-only secrets, per-tenant quota  | `auth.ts`, JWT-namespaced runtimes                                                                                   | node    |

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
discipline into _board structure_ rather than prompt discipline.

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

**2026-08-15 — the approval queue starts SYN-specific and grows into a feature.**
Built first as a board pattern over `store` (G4) plus a facade table, extracted into a
service once a second consumer exists. Deliberately not over-built in phase 2.

**2026-08-15 — secrets are fixed once, by G12, with no stopgap.**
Options considered: (1) redact by header-name heuristic at serialize time — rejected,
heuristics miss and fail _silently_, the worst property for a secret, and they break the
receiving board with no explanation; (3) descriptors declare which state fields are
secret — better, but `headers` is a map whose secret-ness is per-key, so `http-client`
still needs special handling. Chosen: **(2) secrets never enter service state.** Service
state holds a reference (`{{secret.baserowToken}}`); the value lives outside the board and
is resolved at configure time inside the runtime, so it never reaches a client.
Serialization is then safe _by construction_ — there is nothing to redact because the
state never held it. Until it lands, the constraint above is documented rather than
enforced.

**2026-08-25 — nothing in a pipeline merges, and that is a gap of its own (G14).**
Found while building the follow-up board: after `text-generation` reads an email, the
email is gone. Every service _replaces_ what it was given, so anything the pipeline still
needs — the sender's address, the message-id to thread a reply against — does not survive
a service that calls out. The same applies to `http-client` and `document-extract`.

`hold` looked like the answer and is not. It returns `{ [property]: held }` and drops the
rest of the input (`hold.ts:111`), so reading gives back the held value _instead of_, not
_alongside_, what arrived. It also holds per instance, so a write before a call and a read
after it are two services that share nothing — it solves producer/consumer across runs,
which is a different problem.

What the board does instead: one model call produces the extraction **and** the drafted
reply, because the model still has the email in context and needs nothing handed back to
it. That works, and it is cheaper — one inference per email — but it is a workaround with
a visible cost: the draft is keyed `<replyTo> <timestamp>` rather than by message-id, so a
reply cannot yet be threaded (`In-Reply-To`). Anything that genuinely needs two calls over
one input has no answer at all today.

**Direction (cbastuck, 2026-08-25): a meta service built on nested pipelines**, not a flag
on each service that calls out. Not fully specified yet; what is settled is the shape —
the pipeline splits, a part runs on a copy of the input, and the result is merged back
under a name:

```
{ serviceId: "join", state: { as: "extraction", pipeline: [ ...services... ] } }
   in:  the email
   out: { ...the email, extraction: <what the nested pipeline returned> }
```

That composes with the SubService machinery every runtime already has, and leaves the
services inside the branch unchanged — they still replace their output, which is only a
problem when nothing catches it.

Open, and deliberately not decided yet:

- **One branch or several.** `{ as, pipeline }[]` would let independent branches run over
  the same input and merge under different names. Whether they run concurrently is a
  second question, and a runtime that calls services in order has no concurrency story.
- **What merges into what.** A shallow spread is the obvious rule; a nested pipeline that
  returns a scalar, or `null` to stop, needs one that is stated rather than implied.
- **Whether the outer input should be reachable from inside the branch**, or only the
  value handed to it.
- **`null` inside a branch.** Stopping a nested pipeline is a normal thing to do — a
  Filter does it — and it must not read as "stop the outer pipeline too".

**2026-09-04 — G12b decided; the options below are closed. See TODO-SECRETS.md.**
Chosen: references stay inline in service state and are resolved at point of use through
`withSecrets(state, { to })`, which requires a destination and checks it against an
`audience` recorded on the vault entry (learned on first use). Values reach remote runtimes
in the `POST /runtimes` create payload, into a per-runtime in-memory map with no read path,
carrying only the aliases that runtime's board references. Provisioning asks the user per
(board, runtime, url, alias set). `redactSecrets` and the `imap`/`smtp` masking convention
are both deleted. This is option 2 below, generalised from `http-client` to every runtime,
plus the destination binding that option 3 would not have given on its own.

Two things the note below does not say, both found on 2026-09-04. Value-matching is not
merely imprecise, it is a **dictionary oracle**: a hostile board carries unbounded
candidate strings and reads off which ones matched, with the alias, as soon as the victim
saves or shares. And redaction had by then grown two callers beyond `http-client` —
`overview/shape.ts` and `overview/activity.ts`, the latter scanning pipeline data. The
larger hole is the forward path, which no amount of redaction touches: an imported board
writing `{{secret.gmail}}` into an `http-client` URL exfiltrates on first run.

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
the case G12 exists for: every SYN credential rides in a header.

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
   objection was about _declaring_ which keys are secret, and a header whose value was
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
needs, and a new REST endpoint would have to re-solve it _worse_: either reusing the
user's JWT, which expires while the board keeps running, or minting a third credential.
The coordinator also **drives the chain itself** — `bridgeProtocol.ts:92` states that
routing one runtime's result to the next "is the coordinator's own job" — so the
board-level skeleton (which runtime ran when, with what outcome) needs _no service
cooperation at all_. Services only enrich a trace the coordinator already has.

**2026-08-15 — reading history is a REST route guarded by the user JWT.**
Ingestion stays on the sockets (above); reading is the opposite verb with opposite needs
and gets a route. A filesystem-only option was considered and rejected: it left the
run-history gap against n8n wide open, which is the one operational feature that gap
analysis kept identifying as the reason people tolerate n8n at all.

Auth needs no new mechanism. `router.ts:21` already puts every board route behind
`router.use("/users/:username", auth, requireSelf)` — a valid token _and_ `sub` matching
the username path param (`coordinator/auth.ts:23`). The log route slots in beneath it and
inherits both, with the same per-user namespacing `fileBoardStore` enforces on disk.

Explicitly **not** the per-runtime session token. That is a machine credential, minted per
runtime and deliberately long-lived so it outlives the user's JWT; letting it read board
history would widen its blast radius from "push frames for my own runtime" to "read
everything this board ever logged". The two credential classes stay separate: **session
tokens push, user JWTs read.**

**2026-08-28 — node evaluates expressions with the browser's parser, not `new Function` (G15).**
`expression.ts` compiled every Map term with `new Function`, which made a board's template
arbitrary JavaScript in the hkp-node process. Verified rather than assumed: a term reading
`params.x.constructor.constructor('…')()` returned `uid=501(…)` from `execSync('id')` —
file reads, `process.env` and process spawning all followed from the same one line.

Two exposures, and they were not equally bad. **Configuration → code** is by design: a Map
template *is* code, and it is gated by auth, which is fail-closed (`index.ts:293-343` —
a non-loopback bind with no Auth0 refuses to start, as does `ALLOWED_EMAILS` without it).
The honest statement of that one is *anyone allow-listed can run code as the hkp-node user*.
**Data → code** was not by design: `map`'s sensing mode built a template out of *input*, and
a key ending in `=` became an expression — so a field named `pwned=` arriving from an
unauthenticated mount, an email body or an HTTP response was compiled on the next pass.
Demonstrated, then fixed separately in `map.ts` (`sensed()` strips the suffix).

Both close by making the evaluator a real boundary. hkp-node now parses to an AST and
interprets it with **expression-eval — the same library the browser already uses**, so
`process`, `require` and `globalThis` are names nothing answers to, and the walk out
through `constructor` / `__proto__` / `prototype` is refused by the evaluator even when
reached through a computed key. It is the only dependency `map` needed and it is pure JS,
so hkp-node stays free of native ones.

The dialect is the second half of the reason, and it is not a side benefit. `map.ts`'s
header already claimed both runtimes shared a dialect so one UI could serve both; it was
not true, and a template written against node's fuller JavaScript failed on import with
`Unclosed ( at character 14`. Now the claim holds by construction. The migration cost was
checked, not assumed: no board under `hkp-frontend/boards/` uses an object literal, arrow
or template string in a term, and all 381 existing tests passed unchanged.

Boundaries are only boundaries while nobody widens them: **no helper in `globalScope` may
return a constructor, a module, or a route to either.**

**2026-08-28 — iteration is a service, and it is called `iterator` (G16).**
`conversations.actionable` first fanned out itself: it returned `null` and called
the rest of the pipeline once per conversation, copying `store`'s `release`. That
works, and it was the wrong place for it. Iteration buried in whichever service
happened to need it first is invisible in the board, unavailable to the next
service that produces a list, and against **structured flow over wires** — the
ordered service list is supposed to *be* the flow. So `actionable` now answers
`{ conversations, count }` like any other query, and `iterator` runs a nested
pipeline once per item.

`iterator`, not `looper`: the browser already has `hookup.to/service/looper`, a
tape-loop recorder that replays values at their original timing — an unrelated
service with a name that would have collided, in the docs directory as well as
in the registry. Two ids for one name is exactly what
[TODO-CONSOLIDATION.md](TODO-CONSOLIDATION.md) §1 exists to prevent, and a
serviceId is baked into every board that uses it.

It subclasses `SubService` rather than copying it, so nesting, scope propagation,
notification forwarding and log forwarding are the ones already in use. Three of
that class's fields became `protected` for it. A trap worth remembering: the base
constructor calls `configure`, but a subclass's fields are defined only once
`super()` returns — so `itemsFrom` and `limit` were read and then immediately
overwritten by their own declarations. Declaring them without an initialiser does
not help; a class field is defined as `undefined` either way. The subclass
re-reads its own half of the state after `super()`.

Semantics settled while building it: a single item is an array of one; an item
whose pipeline returned `null` contributes nothing, which makes a filter-shaped
sub-pipeline a filter; collecting nothing stops the outer pipeline rather than
passing an empty array; and one item throwing is counted, not propagated —
nine conversations should not go unprocessed because the tenth had a malformed
address.

This is one of G5's ten control-flow services, arrived at from the other
direction.

**2026-08-28 — G14's synchronous half is `join`; its asynchronous half is the real problem (G14b).**
Building the SYN board hit the split-and-re-join gap head on: `read-thread` knows the
conversation, `text-generation` replaces its input with an answer, and `put-artifact` then
has nothing to file it under. `join` is the structural answer the earlier decision called
for — a nested pipeline as a *detour*, with the input carried past it — and it works.

It does not work here, and that was found by running the board rather than by reasoning
about it. The notification dump is the whole story:

    extract          -> {"status":"generating"}
    keep-extraction  -> {... "payload": null ...}      ← already ran
    advance          -> {...}
    extract          -> {"text": …, "json": {…}}       ← the answer, afterwards

**`text-generation` is asynchronous**: it returns `null` and pushes its result down the
pipeline when it arrives. `join` merges what the nested pipeline *returns*, so it sees
nothing. Checked, not assumed: `hold` cannot stand in either — it replaces its input and
holds a single slot, so it cannot carry per-item state with several conversations in
flight.

Two consequences, both shipped:

1. `join` now **stops** when its detour produces nothing, instead of passing the input
   through. The pass-through is exactly what filed an artifact with `payload: null` and
   advanced the conversation as though extraction had succeeded — worse than stopping,
   because downstream cannot tell it from a merge that worked.
2. `text-generation` grows `carry: string[]` — input fields copied onto its answer. The
   carrier rides *with* the data through the asynchronous gap, which is the only thing
   that works today. The board uses `carry: ["conversationId"]` and a flat nested
   pipeline: `read-thread → as-prompt → extract → put-artifact → transition`.

`carry` is a per-service answer to a general problem, and that is the debt. The general
fix (**G14b**) is for `join` to register a result target on its nested runtime and merge a
late result with the input it remembered. That needs correlation, and correlation is what
the runtime cannot currently supply: `emitResult` is called by the pushing service *after*
`processFrom` has returned, so the run context is gone by the time a parent could read it.
Until the runtime names the run at emit time, an asynchronous re-join cannot be built —
so `join` says so in its own header rather than failing quietly in somebody's board.

**2026-08-28 — the hkp-node pipeline awaits its services (G14b closed, and `carry` reverted).**
The previous entry called `carry` debt and named the blocker as "the runtime cannot say which
run a late result belongs to". That framing accepted the wrong constraint. The question is not
how to correlate a late result with its run — it is why a service answering a call has to
leave the call at all.

**The browser runtime already awaited** (`BrowserRuntimeScope.ts:235`). hkp-node did not
(`runtime.ts`, `result = service.process(...)`), and every service that needed time worked
around it by returning `null` and calling the rest of the pipeline itself. That workaround is
what destroyed the input: by the time the answer existed there was nothing left to re-join it
with, and it is also why control flow behaves differently across the two runtimes.

So the loop awaits. `text-generation.process` returns its answer, `join` merges it, and
`carry` is gone — reverted rather than kept, because a workaround left in beside its own fix
is the version somebody copies next.

Two things this forced, both of which the old code had already predicted:

- **Ambient run state had to stop being a field.** `withContext`'s own comment said it: *"Safe
  as ambient state only because a pass is synchronous… A pass that awaited would need the
  context threaded through the call instead."* Two runs started independently — a timer tick
  and an arriving message — now interleave across awaits, and a plain field would let the
  second overwrite the first mid-flight, misattributing every log entry after that point.
  `AsyncLocalStorage` gives each run its own view and restores the outer one leaving a nested
  pull, which is what the old restore-don't-clear behaviour was for.
- **Detached pushes had to be made explicit.** Five services are genuinely autonomous — timer,
  imap-email, telegram-listener, peer-server, http-server — and have no caller to answer. Their
  pushes are now `void`-marked with the rejection reported, since an unhandled one would take
  the runtime down over a single bad event.

Consequences accepted deliberately: an `iterator` processes its items **sequentially**, so a
poll costs items × model latency (one request in flight suits a provider's rate limit; a
`concurrency` option can come later if it bites). `POST /runtimes/:id` now answers with what
the pipeline produced rather than `null` while the work continued, which is better and is a
contract change for anything that was relying on the immediate return.

Unchanged, and worth stating because it was assumed otherwise: **`stream` never emitted more
than once.** `push` was called exactly once; streaming only ever produced `{streamText}`
notifications for the panel. It means "show it arriving", and it still does.

**2026-08-28 — a nested pipeline heard its board's scope one level down, and no further.**
Found by running the SYN board, not by reading it: the drafting prompt said
`Still missing: (unknown)` when the extraction plainly recorded two missing fields.

`SubService.rebuild()` builds its runtime with `boardName: ""`, and a `HostedRuntime`
constructed without an owner defaults to the **anonymous** one. `applyScope()` corrects that
at `setHost` — but a service's nested runtime is built in its constructor, so a pipeline two
levels deep was told the scope its parent held *at that moment*: anonymous, and no board.
Nothing re-propagated afterwards.

`conversations` inside a `join` inside an `iterator` is exactly that shape, so the SYN board's
`list-artifacts` was reading a database keyed on `sha256("") / anonymous` — **one file, shared
by every tenant and every board**. The file-per-board isolation `database.ts` was written for
held for one level of nesting and quietly did not for two. Visible on disk as a second, empty
`.db` beside the real one.

`HostedRuntime.setScope` now passes the scope to its services, `SubService` and
`http-server-subservices` pass it to their own runtimes, and that recurses to any depth.
`tests/nested-scope.test.ts` pins it — verified to fail without the fix — and asserts the
shared nowhere stays empty.

Worth keeping in mind for anything a nested runtime inherits: log settings travel the same
one-level path (`applyLogSettings`), so a doubly-nested pipeline records against its parent's
settings at construction rather than the board's. Not a correctness or isolation problem, so
it is noted rather than changed.

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
    `sparse` therefore means something stronger than before — _a local engine could not
    read these pages either_ — which is exactly the point at which paying is justified.
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

  **Approval is no longer final (2026-08-16).** A released record is _leased_, not
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
  _does_ survive the async gap — services capture it and hand it back to `processFrom`.
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
  where local OCR is weakest. The claim is _"most documents cost nothing, the hard ones
  cost a known, capped amount"_ — not _"free"_.
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
call is an inspectable pipeline, a log that cannot show _"the model called this tool, which
ran these three services"_ misses the feature it exists to support — and tool calls
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

This is trace/span in miniature (`runId` ≈ trace id). Deliberately _not_ a full span model
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
- **One log per board**, containing entries from _every_ runtime — that stitching is the
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
_will_ eventually log something it should not. So redaction is the last layer, not the
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
  `data` crossed the wire regardless. The route must be able to serve entries _without_
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
  two runs _cannot_ interleave inside a pass. The ambiguity is only about runs that
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

- **Playground boards have no run history.** In the playground the browser _is_ the
  coordinator, so there is no filesystem to write to — history is a cloud-board feature,
  and the playground gets the live stream only. Documented here so it does not arrive
  later as a bug report.
- **Log frames share the wire with runtime results**, so a board processing 500 offers has
  logging competing with its own data. Deliberately **not** designed around now: batching,
  caps and frame priority are all available if it ever proves to be a bottleneck, and that
  call should be made on measurements rather than on an assumed load.

---

## Phase 2 — the differentiators

Goal: the things that make Readymade the _right_ tool rather than an adequate one.

- ✎ **G1b — tool-use as sub-pipelines.** Per the decision above. Ship G1's wire format
  first and grow into this. Effort L.
- ✎ **G6 — approval queue.** Table-backed decoupling: everything awaiting a human collects
  in one place, the flow continues when it is released. Built over `store` (G4) plus a
  facade inbox; extracted into a service once a second consumer exists. This is the
  missing _concept_ — today a board is a pipeline with no first-class notion of a parked,
  resumable work item — and it is where n8n is weakest. Effort L.
  **Shares its core widget with G10 — see the coupling note there.**
- ☐ **G13 — `baserow` and `missive` services.** `http-client` covers both on day one;
  wrapping them buys schema introspection (which serves C4 directly), batch upsert,
  filtered list, attachment fetch, comments and labels. Effort M each.

---

## Phase 3 — board as a product surface

### G10 — public board pages, read **and** write

Decided (2026-08-15) to be a **Readymade feature**, not a SYN deliverable. Pushing
on the human-AI-collaboration framing grew it past a page renderer.

The customer's section 4 is output-only: a client reads a comparison. But their section 5
pain contains the two-way case — they need to ask hotels follow-up questions and collect
answers, which today is email ping-pong returning as unstructured prose, the exact thing
they are trying to escape.

So the feature is **"publish a board as a page that can send structured data back into the
board"**, because _the cheapest way to get structured data out of a hotel is not to parse
their prose at all — it is to hand them three fields._ That shrinks the extraction problem
rather than solving it.

And the natural widget is not a form but a **diff/confirm view**: _"here is what we read
from your email; correct anything wrong."_ The model proposes; a human outside the
organisation corrects it, structurally. That is the human-AI collaboration loop Readymade
exists for, pointed at someone without an account.

**Coupling note — this is the same widget as G6.** The internal approval checkpoint and
the external correction page are one propose-and-confirm surface, pointed inward and
outward. G6 sits in phase 2 and G10 in phase 3; building them two phases apart means
building it twice. **Pull the shared widget design forward and let both consume it.**

Approach, decided:

|     | Approach                                                                                                  | Effort | Assessment                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| A   | `html-template` service on an `http-server` mount                                                         | M      | Cheap, but not a facade — a parallel rendering stack with zero widget reuse. Architectural dead end. Proposed then withdrawn. |
| B   | **Public facade route** `/view/<unguessable-id>`, coordinator-served, URL params bound into service state | L      | Reuses `data-table`, `repeat`, `line-chart` and the rest. Chosen.                                                             |
| C   | B plus a `html` / `rich-text` facade widget                                                               | L+     | Covers the free-layout gap that drove them off Baserow's app builder. Likely follow-on.                                       |

**Design questions**

- **Identity without accounts.** The unguessable-URL model (the mount precedent) works for
  a link sent to one recipient. But "who submitted this" matters once two hotels hold
  links. Answer: **per-recipient links, minted per request — the URL _is_ the identity.**
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
  runtime. What it does not ship is n8n's _visual_ re-execution view — inspecting a past
  run node by node and replaying it. Data parity, not UI parity.
- **Board versioning and staging.** Nothing beyond deploy today.

The pitch is not "replace n8n". It is: **the part of their process that is a stateful,
human-in-the-loop, cost-shaped app is the part n8n is worst at, and it is the part they
have labelled completely open.** Stateless webhook chains can stay where they are.

---

**2026-08-28 — the workflow is a star, and the manager in the middle is a model (G17).**

The board had one runtime per business step: a runtime that extracts, a runtime that
drafts a follow-up. Each polled the state its step handles and did the one thing it
knew. That reads as five runtimes and does not read as a workflow — the rules are
recoverable only by noticing which states each runtime selects on — and every new
action was a sixth runtime that was 80% copy of the fifth.

`communication-dispatcher` replaces the arrangement. It holds one nested pipeline per
**action**, and decides which to run. Runtimes 2 and 3 of the SYN board collapsed into
one; the two actions moved in unchanged.

The decision is a model's, and that was the explicit call: what arrives is a person
writing an email, and no expression over `state` anticipates what they will say. A
`when`-expression router — the browser `switch`, in effect — was the alternative and
was rejected as shooting short.

Three things keep the looseness bounded, and they are the design:

- **The answer is enumerated.** The service generates the JSON schema for the decision
  from its own actions and states, and pushes it into whichever nested service takes a
  `jsonSchema`. `action` and `next` are enums of what exists. An invented action cannot
  be uttered. Because the schema is derived, it cannot drift out of step with the
  actions the way one written by hand beside them would.
- **An action can say when it is possible at all** (`available`, an expression over the
  input). This is not routing — it is which moves are legal this turn. Sending an
  approved draft is not a judgement call when there is no approved draft. Narrowing the
  menu to legal moves makes the choice better, not more rigid.
- **`wait` is always on the menu.** A model asked to choose must choose; without a way
  to say "none of these", an exchange waiting on a customer gets a second follow-up.

Two things fell out of building it that were not in the plan:

- **Waiting had to be allowed to change the state.** The first cut returned nothing on
  `wait`, and a complete enquiry could then never reach `ready` — every route out of a
  state ran an action, and there was no action to run. Waiting now carries a `next`, and
  passes nothing on only when that is the state the exchange is already in.
- **The prompt stays in the action, not in the dispatcher.** The original suggestion was
  that the dispatcher generate and hand over the prompt. It would have moved every
  prompt into one service — the same baking in a different file. What the dispatcher
  hands over is `params`, which is the reusable half: one drafting action told what to
  ask about, rather than one action per question.

One action per pass, and the loop is the poll. The machine's position is then a row
someone can read rather than a stack frame, a restart resumes, and a model that changes
its mind costs one call per tick rather than a budget in an unwatched cycle. The cost
guard was already in the right place: `actionable` takes `idleSeconds`.

`nested-pipeline.ts` came out of `sub-service.ts` to hold a pipeline-inside-a-service:
notification forwarding, log forwarding, scope, rebuild, destroy. The dispatcher has one
per action, and getting scope wrong is silent rather than loud — last week's
cross-tenant database bug was exactly that — so it is one implementation. `SubService`
and `http-server-subservices` still carry their own copies; porting them is a separate,
verifiable step and is not done.

**2026-08-28 — approving a reply does nothing at all (G18).**

Found while answering "where does an approved follow-up go?". The `approve` runtime is
one `set-artifact-status`. There is no `smtp-email` anywhere in the board, and nothing
moves the conversation out of `waiting-approval`. Approving means a row changes colour.

Three separate pieces are missing, and only the first is obvious:

1. A send leg — poll `status=approved, kind=follow-up`, send, mark done.
2. `smtp-email` takes `to`/`subject`/`from` from **config**, not from its input. Fine for
   a fixed alert sink; useless when the recipient is whichever customer this conversation
   belongs to. It needs the input-decides-over-config rule `conversations` already applies
   to `conversationId` and `store` applies to its key.
3. The sent mail must be filed back into the thread (`ingest` with
   `direction: "outbound"`). Skipping this is quiet and expensive: the customer's reply
   arrives with an `In-Reply-To` naming a message the store has never seen, `threadOf`
   finds no match, and a **second** conversation opens. The bug surfaces days later as
   duplicate threads, not at the point of the mistake.

The send action belongs on the dispatcher as a third action, gated on
`available: "…an approved draft exists…"` — which is the case `available` exists for.

---

**2026-08-28 — the reply goes out, and comes back into the thread (G18 closed).**

`smtp-email` gained a second mode. `configured` is unchanged and stays the default —
the existing demo board sends the same mail it always did — and `envelope` takes the
recipient, subject, body and threading headers from the input.

Keeping that behind a mode rather than letting the input win is the one place HKP's
input-decides-over-config rule is deliberately not applied. A `to` drifting down a
pipeline must not be able to redirect mail that was addressed by configuration.

Three things came out of reading the service that were not in the request:

- **It was fire-and-forget.** `process` did `void this._send(text)` and returned its
  input, so an SMTP failure never reached the pipeline. Marking a draft sent and moving
  a conversation to `waiting-reply` off the back of that would record a send that had
  not happened. Both modes now await, and a failed send produces nothing.
- **It has to answer with the message.** `nodemailer`'s Message-ID is needed to file the
  outbound mail. The answer is in exactly the shape `conversations` ingests, so
  `smtp-email → conversations(ingest)` wires up with nothing in between.
- **`In-Reply-To` / `References` are load-bearing.** Not for the guest's client — for us.
  `threadOf` matches an incoming reply against messages it already has, so a reply sent
  without those headers *and* not filed means the guest's answer opens a second
  conversation. `tests/outbound-threading.test.ts` demonstrates that failure
  deliberately, beside the case that works.

Two small additions in `conversations` fell out of it:

- **`thread` reports `lastInbound`.** A reply goes to whoever wrote *in*, and the
  restricted expression dialect has no way to search a list for that. Taking the last
  email is right only until we have sent one — then a board addresses its reply to its
  own sending address.
- **`set-artifact-status` takes `idFrom`.** After sending, the pass carries what was
  sent, not the draft. Without this the board needs a Map purely to satisfy the next
  service.

`allowedRecipients` guards the destination — addresses or `@domains`, empty meaning
unrestricted. The address is data: it comes out of a thread, and the step that sends was
chosen by a model. What a person approves is the text, not where it goes. A `dryRun`
switch was offered alongside and declined.

The board gained a third action, `send`, gated on
`available: "params.approved.count > 0 && params.thread.lastInbound"` — which is what
`available` is for: there is no judgement to exercise about sending a draft nobody has
approved, so it is not put in front of the model at all. Its SMTP fields ship **empty on
purpose**. This is the one action on the board that cannot be undone, and it fails loudly
until someone fills them in.

Still open: `smtp-email` cannot attach anything, and nothing reads `Delivered-To` or a
bounce, so a message the server accepted and then failed to deliver looks like success.
