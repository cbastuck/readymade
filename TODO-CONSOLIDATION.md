# Cross-runtime consolidation — for a fresh session

Three related problems surfaced while building the mount work (Aug 2026). All are
cases where a mismatch between runtimes is **silently absorbed** instead of
reported, so a board that is wrong looks like a board that works.

---

## Facade actions: asking a service to act, not just configuring it

**Closed 2026-08-17.** A facade could only ever *configure* a service, so any button that
had to cause work smuggled it in as a config field the service read as a command
(`timer.start`, and briefly `store.keys`). Configuration is saved with the board, which
makes that wrong twice over: a choice somebody made once comes back the next time the
board is opened.

`process` is now a facade action — `{ type: "process", serviceUuid, payload }`, with the
same `$$input` / `{ "$state": … }` substitution a configure payload gets — and every
runtime exposes the entry point behind it:

| Runtime | Entry point | Route |
| --- | --- | --- |
| browser | `scope.next(svc, params, ctx, advanceBeforeProcess=false)` — already existed | — |
| hkp-rt | `Runtime::processAt` over `processFrom(svc, data, advanceBefore=false)` — the flag already existed | `POST /runtimes/<id>/services/<id>/process` |
| hkp-node | `HostedRuntime.processAt` | same |
| hkp-python | `HostedRuntime.process_at` | same |

The distinction the name carries: `processFrom` means "carry on behind me" and therefore
*skips* the service it names, which is what a service handing work onward wants. Starting
**at** a service is the opposite question and got its own entry point rather than a flag on
that one, so the advancing call every service depends on could not change shape by
accident. hkp-rt and the browser already had `advanceBefore` / `advanceBeforeProcess` and
simply had nobody asking; node and python gained the capability.


## 1. Service ids and state contracts differ per runtime

A board is supposed to move between runtimes. Nothing checks that it can, and
three separate breakages were found by hand in two days:

| Service | Divergence | Status |
| --- | --- | --- |
| `stopper` | Existed only on browser (`hookup.to/service/stopper`) | Added to node, python, hkp-rt as `stopper` |
| `timer` | python used `hookup.to/service/timer`; node and hkp-rt use `timer` | python now canonical `timer` + creation-time alias for the old id |
| `http-client` | hkp-rt supported only `url`; node/python added `__hkpMount` + `path` | All three now share the contract |
| runtime lifecycle | hkp-node reaped on last disconnect; hkp-python and hkp-rt never reaped | Resolved: `garbageCollected` is declared in the create payload, default persist, honoured by all three |
| `POST /runtimes` with an existing id | hkp-node reused the running runtime; hkp-python and hkp-rt rebuilt it | Resolved: `POST` provisions (create-or-replace) everywhere, `GET` attaches, and the client says which it means |

Each was found by loading a board and reading an error — or worse, by a 500 with
an uncaught `Unknown serviceId`.

**What to do**

- Decide the canonical id per service across browser / node / python / hkp-rt.
  The browser's `hookup.to/service/*` prefix is the outlier; backend runtimes use
  bare slugs.
- Keep a **creation-time alias** wherever an id changes, as python's timer now
  does: the alias resolves but is not advertised in the registry
  (`RuntimeApp.get_registry` dedupes by descriptor id). Boards saved against the
  old id keep loading.
- Audit state contracts too, not just ids — same service, same field names. The
  `http-client` case was an id match with a contract mismatch, which is worse:
  the board loads and then does nothing.

The provisioning row turned out not to be a runtime divergence at all. `POST` and
`GET` already express provision and attach; the browser simply posted the board
either way, so each runtime picked a default for the ambiguity. The client now
asks first (`restoreRuntime` → `attachRuntime`), which means:

- a page reload re-attaches on every runtime, not just hkp-node — services keep
  running and published addresses stay valid;
- `POST` means provision everywhere, so hkp-python's and hkp-rt's rebuild is
  correct rather than divergent;
- hkp-node's reuse-by-id is now a workaround nothing depends on. Removing it
  would make `POST` mean the same thing on all three — worth doing once no
  older client is expected to post-to-attach.

**The test that would have caught all three**: load every board in
`hkp-frontend/boards/` and, for each service on a non-browser runtime, assert the
`serviceId` resolves in that runtime's registry. All four registries are now
reachable from tests. Cheap, and it turns a runtime error into a build failure.

---

## 2. `hkp://remotes/<name>` addressing is not verified consistently

`hkp://remotes/<name>/…` is the app-internal proxy to an embedded runtime. The
platforms disagreed on what happens when `<name>` is not theirs:

- **Android** — `HkpSchemeRouter.serveRemotes` compares against its configured
  remote name and returns `404 "Unknown remote"`.
- **Desktop** — `handleRemoteForward` captured `:remote` and never read it, so
  `hkp://remotes/anything/…` reached the embedded runtime. **Fixed** (Aug 2026):
  it now 404s unless the name matches `m_server->name()`.
- **iOS** — synthesises URLs from `AppBridgeConfig.runtimeRemoteName`; the
  routing side was never checked against an unknown name. **Still to verify.**

Why it mattered: a board pointing at a runtime that was not running loaded
anyway and ran on the embedded runtime instead — no failed request, no port in
use, nothing in the UI to say which runtime was answering. Debugging that
consumed most of a session.

**What to do**

- Verify the iOS path rejects unknown names the way desktop and Android now do.
- Then decide whether remote *aliases* are wanted as a feature — addressing a
  remote by name rather than by `IP:PORT` is genuinely more portable for boards,
  but it needs designing (where names are defined, how they resolve, what
  happens when one is missing) rather than falling out of an unchecked route
  parameter. Failing hard is the correct interim state.

---

## 3. The binary message purpose means different things per runtime

A YAS frame's header carries a `uint16` **message purpose**
(`NOTIFICATION | RESULT | RESULT_AWAITING_RESPONSE | RESULT_WITH_REQUEST_ID`).
Unlike the JSON path — which names its intent in a `type` field
(`processRuntime` / `resolveResult`) — the binary path has only the purpose to
distinguish "push this through the pipeline" from "this resolves the request you
are waiting on". The runtimes do not agree on how to read it:

| Runtime | Incoming binary frame | Consequence |
| --- | --- | --- |
| hkp-rt | `NOTIFICATION` → resolve the pending callback named by `sender`; anything else → `process()` (`lib/src/runtime.cpp:585`) | The only runtime that dispatches on purpose |
| hkp-python | Purpose parsed into `Message`, then never read — every binary frame is processed (`src/hkp/server.py:751`) | Cannot receive a binary `resolveResult`; it would be misread as a fresh push |
| hkp-node | No YAS binary path at all | Does not participate |

Found (Aug 2026) via a browser → hkp-rt board sending microphone PCM: the
frontend's `serializeYasMessage` hardcoded `NOTIFICATION` for every binary frame,
so a `processRuntime` push arrived at hkp-rt as a resolve for request `""`, found
no pending callback, and was dropped. hkp-python had accepted the identical frames
for months precisely *because* it ignores the field. **Fixed** on the frontend
side: `serializeYasMessage` takes the purpose, and `sendMessageViaWebsocket`
derives it from the same `type` the JSON branch uses
(`hkp-frontend/src/runtime/rest/Message.ts`, `RuntimeRestScope.ts`).

This is the pattern in §1 and §2 again — the wrong frame produced no error on
either side, just silence, and the runtime that was strict about it looked broken
next to the runtime that was lax.

**What to do**

- Decide the canonical meaning of each purpose on receive, and make all three
  runtimes implement it. hkp-rt's reading is the considered one; hkp-python's
  "process everything" is an absence of handling, not a decision.
- Give hkp-python a resolve path so an async service can be resolved over the
  binary transport, or state explicitly that binary is push-only and have it
  reject a `NOTIFICATION` frame loudly rather than processing it.
- The asymmetry deserves recording wherever the format is documented
  (`src/hkp/yas.py` has the best description today): the same purpose value means
  "notification from a service" travelling runtime → browser and "resolve this
  request" travelling browser → runtime. That reuse is the trap.
- **The test that would have caught it**: a round-trip per runtime — push a
  `FloatRingBuffer` over the binary WS and assert it reaches the first service.
  It fails loudly where a dropped frame currently fails silently.

---

## 4. Per-call process context exists in one runtime and is named after something else in another

Surfaced (Aug 2026) while designing board-level logging — see
[TODO-WORKFLOW-PLATFORM.md](TODO-WORKFLOW-PLATFORM.md) G7, which needs a run identity to
travel with a process call and found there is no shared place to put one.

| Runtime | Per-call context | Type named `ProcessContext` | Reply address (`requestId`) |
| --- | --- | --- | --- |
| browser | `ProcessContext { requestId, onResolve? }`, optional param on `processRuntime` / `next` / `onResult` (`src/types.ts:318`) | ✅ that concept | ✅ |
| hkp-rt | a loose `json context`, read as `context["requestId"]` (`lib/src/runtime.cpp:527`) | ☑ name was taken by an unrelated re-entrancy depth counter; **renamed to `ProcessDepth`** (`lib/src/process_depth.h`), so the name is now free | ✅ via `storePendingCallback` / `PendingResolve` (`lib/src/runtime.h:90,104`) |
| hkp-node | none — `process(input, notify)` (`src/types.ts:71`) | — | — |
| hkp-python | none — `def process(self, input, notify)` | — | — |

Two separate problems, and the second is the dangerous one:

**The concept is missing on two runtimes.** The browser threads a per-call context; node
and python have no notion of one. Anything that must travel *with* a call rather than with
the data — a run id, a deadline, a cancellation signal, a trace flag — has nowhere to live
on two of the four runtimes.

**The name was already taken in hkp-rt for something else.** `ProcessContext` there was a
counter: `onProcessBegin()` increments, `onProcessEnd()` decrements and emits the result
only when it reaches zero — it tracks re-entrancy depth so a nested process call does not
prematurely report a result. A genuinely different concept that happened to share the
name, which would have reproduced §1's worst case exactly: one name, two contracts,
silently absorbed. **Renamed to `ProcessDepth` (Aug 2026)** — `lib/src/process_depth.h`,
five references across three files, not listed in `lib/CMakeLists.txt` so the file rename
was free.

**Status — done (Aug 2026)**

- ☑ Rename hkp-rt's counter to what it does — `ProcessDepth`.
- ☑ `ProcessContext` defined as the canonical per-call context (`runId`, `parentRunId`,
  `requestId`) and adopted in **hkp-node** and **hkp-python**; **hkp-rt**'s loose
  `json context` is now that struct (`lib/src/process_context.h`, with `fromJson` /
  `toJson` at the wire boundary); **hkp-frontend**'s existing type gained the same two
  fields.
- ☑ `requestId` keeps meaning exactly what it meant — a reply address, not a run identity.
  `runId` sits beside it.
- ☑ `HostedService.process` unchanged on every runtime. A pass is synchronous, so the
  runtime holds the current context and services read it through
  `currentContext()`; explicit passing is only needed where a run crosses an async gap.

Verified: hkp-node 186 tests + 10 new, hkp-python 198 + 10 new, hkp-rt 108 (built and run),
hkp-frontend 829 (typecheck unchanged at 3 pre-existing unrelated errors).

**What remains**

- The **browser runtime does not mint a `runId`** for calls it originates — the type
  carries the field and the JSON wire passes it through, but nothing sets it yet. That is
  G7's work, along with threading it through `next()`.
- The **binary (YAS) path carries only `requestId`** in its header, so a context crossing
  as a binary frame loses `runId`. Related to section 3 above; needs deciding alongside it.

hkp-rt's depth counter turned out to be a useful hint for the nesting question: one runtime
already had to track how deeply nested a process call is in order to know when a run is
finished. G7 settled on `parentRunId` as a required field for the same reason.

---

## Open decisions from the same work

- **`referenceMount` has no caller.** Implemented and tested in
  `hkp-frontend/src/core/coordinator.ts` (address → `hkp-mount://` reference).
  The natural use is re-referencing a board imported with baked addresses. Wire
  it up or delete it.
- **Port 0 reset.** `http-server-subservices.configure` applies bypass first, so
  configuring `{port: 0, bypass: false}` in one call starts the server on an
  ephemeral port and then overwrites the recorded port with 0. The listener and
  the published `__hkpMount` are correct; `getState()["port"]` is not. Fix by
  ignoring a requested port of 0 after binding.
- **hkp-rt's http-client requires JSON object input** while hkp-node's accepts
  anything — another contract divergence, not yet aligned.
