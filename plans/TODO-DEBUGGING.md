# Debugging a running board — for a fresh session

The overview (`hkp-frontend/src/overview/`) draws every service on every runtime at
every nesting depth and lights each one as it is called. It is already the place a
board is *watched*. This is about the next step: **stopping** a board and walking it
one invocation at a time.

Raised Aug 2026 while building the overview. Nothing here is implemented.

---

## Decided already

**No trace / record mode.** The obvious cheap alternative — keep a rolling log of
recent `call-process` pairs and scrub back through them — was considered and
**rejected**: logging already answers that question. What logging does *not* do is
let you stop the board and look around, which is the actual want.

**Consolidate logging first.** See the prerequisite below. Debugging should not
grow a second, parallel way of reporting what a board did.

---

## 0. Prerequisite: logs are plumbed everywhere, surfaced only for cloud boards

`RuntimeScope.registerLogTarget` exists on **both** scopes — `BrowserRuntimeScope`
(`hkp-frontend/src/runtime/browser/BrowserRuntimeScope.ts:52`) and `RuntimeRestScope`
(`hkp-frontend/src/runtime/rest/RuntimeRestScope.ts:211`) — and remote runtimes already
push entries over the websocket, which `RuntimeRestScope:132` re-emits.

The **only consumer is the cloud view**
(`hkp-frontend/src/views/cloud/useCoordinatorBridge.ts:289`). A playground board
produces log entries that nothing reads.

**What to do**

- Surface the same stream for a locally-owned board. The scope already offers it;
  this is a consumer, not new plumbing.
- Decide where it belongs: a panel in the playground, a section in the overview's
  detail panel (per-service, filtered by uuid), or both.
- Only then judge how much of the debugging want is left over.

---

## 1. The gate: where a step actually happens

Every runtime's pipeline loop has exactly **one** call site per service, already
bracketed by the notification pair the overview consumes. That bracket is the seam.

| Runtime | Loop | Bracket |
| --- | --- | --- |
| browser | `BrowserRuntimeScope.next`, `runtime/browser/BrowserRuntimeScope.ts:220-248` | `onServiceProcess` → `await svc.process(params)` → `onServiceResult` |
| hkp-node | `HostedRuntime.processFromIndex`, `hkp-node/src/runtime.ts:564-632` | `emitNotification(call-process)` → `await service.process(…)` → `emitNotification(call-process-finished)` |
| hkp-python | `HostedRuntime`, `hkp-python/src/hkp/runtime.py:439-484` | same pair |
| hkp-rt | `Service::process` bracket, `hkp-rt/lib/include/service.h:51` | same pair |

Both TS loops are already `async`, so the gate is one line where `call-process` is
emitted: `await debug.gate(runId, uuid)`.

**What this buys immediately.** When the gate holds a service, the overview already
lights that node, and the detail panel's **Last in** already holds exactly what it is
about to receive (`overview/activity.ts` captures the `call-process` payload). Stepping
is releasing one gate. The debugger view largely already exists.

---

## 2. Pause must gate *entry*, not only the space between services

A gate only between services does not stop a board — it queues it. A Timer at 1 s
accumulates one blocked pass per second and floods on resume.

So the gate needs two points:

- **Pass entry** — whether a *new* pass is admitted at all.
- **Between services** — where stepping happens.

**Backlog policy is the decision that matters.** Suggested default: while paused,
refuse new passes and count them; the overview shows `paused · 14 passes dropped`.
A queue with a small cap is the alternative, but replaying a burst on resume produces
a board state that never occurred in real time.

---

## 3. Do not fake the clock

"Control JS timers" is tempting to read as intercepting `setTimeout`/`setInterval`.
Don't.

Timers are not central: each Timer service owns its own interval
(`hkp-frontend/src/runtime/browser/services/base/Timer.ts:201`,
`hkp-node/src/services/timer.ts:178`), and Timer is only one autonomous source —
`http-server`, `imap-email`, `telegram-listener`, `peer-server` and AudioInput all
originate passes with no input.

In hkp-node, faking globals would freeze the whole server process: HTTP keepalives,
auth refresh, and the very socket the debugger is talking over.

**State plainly in the UI:** a paused board is not a frozen world. Wall-clock time
keeps running, so an HTTP request will still time out and an IMAP connection will keep
receiving. What is paused is the board's *work*.

---

## 4. Protocol: the transport exists

The overview runs in the browser; the runtimes usually do not. Pause/step is therefore
a protocol operation per runtime — the same contract implemented four times, which is
the `TODO-CONSOLIDATION.md` problem again. Design the contract once, in that document's
spirit, before writing the first one.

| Need | Existing surface |
| --- | --- |
| pause / resume | `POST /runtimes/:runtimeId/debug` fits the existing route family, `hkp-node/src/server.ts:553-909` |
| per-step command | websocket is already browser→runtime: `processRuntime` / `resolveResult`, handled at `hkp-node/src/server.ts:1058`. Avoids a REST round-trip per step |
| gate state → browser | the notification channel the overview already listens on |

A runtime that does not implement the contract must say so, so the overview can grey
out the control rather than pretend a board is paused when half of it is running.

---

## 5. Risks to design for, not discover

**Re-entrancy — the one that will actually bite.** The inversion-of-control pattern in
`CLAUDE.md` has a service return `null` and then call the downstream services itself
(the cache-on-miss shape). That re-enters the loop. A gate keyed on *service* deadlocks:
the nested pass blocks behind the outer pass that is waiting for it. **Key the gate on
the run, not the service.** hkp-node already carries `runState` (AsyncLocalStorage)
through `withContext` / `inService` (`hkp-node/src/runtime.ts:543-562`) and can carry a
run id with it.

**Reaping.** A remote runtime created with `garbageCollected: true` is reaped when its
last client disconnects. Pausing must not look like disconnecting.

**Held responses.** An `http-server` service pausing mid-request holds a client
connection open for as long as the pause lasts.

**Heisenbugs.** Pausing changes timing, so timing-dependent bugs will not reproduce
under it — which is the class of bug people most often open a debugger to find. Worth
saying out loud in the docs.

---

## 6. Suggested phasing

1. **Prerequisite** — logging surfaced for locally-owned boards (§0). Re-judge the
   rest afterwards.
2. **Contract** — write down the pause/step/gate-state contract once, for all four
   runtimes, before implementing any.
3. **Phase 1 — hkp-node + browser.** Node because that is where boards actually run;
   browser because it is nearly free at the same seam and needs no protocol. Ship
   pause, resume, step-one-service, with the drop count visible.
4. **Phase 2 — hkp-python, hkp-rt** to the same contract.
5. **Phase 3 — stepping across the runtime chain.** Deferred: sequencing gates in two
   runtimes is the coordinator's problem, not a runtime's, and is a different design.

---

## Open questions

- Does "step" mean one *service*, or one *runtime pass*? Both are useful; the overview
  can offer both, but the gate contract has to name them.
- What does pause mean for a board whose runtimes are owned by a **coordinator** and
  watched by several browsers? Pausing is a board-wide act with more than one watcher —
  probably the coordinator's call, not a browser's.
- Should a paused board be visible as paused to anything other than the overview?
  A facade driving a paused board otherwise looks broken.
