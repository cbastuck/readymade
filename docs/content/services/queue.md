# Queue

How one board says something to another.

---

## Available in

| Runtime | Service ID |
|---|---|
| Node.js (hkp-node) | `queue` |

---

## What it does

A board owns its data, and a second board has no business reading the first
one's tables — that is most of the reason the two are separate boards at all.
What crosses between them is a **message**: a payload on a named topic, meaning
nothing to the queue and everything to the two boards that agreed on the name.

That makes a queue the joint between boards that run on **different clocks**. A
booking board finishes reading an enquiry in seconds; the hotels it writes to
answer in days. No pipeline spans days, so the two halves cannot be one flow —
but they are still one workflow, and the message is what carries it across.

Use a queue when the two sides are separated in *time*. Two things that happen
in the same second belong in one pipeline, nested for readability — not in two
boards with a queue faking a boundary that isn't there.

### Which queue a `queue` sees

Every other table in this runtime lives in a per-board file, which is what stops
one board reading another's. **A queue is the deliberate exception**, and the
only one: publishing and consuming are by definition not the same board, so the
rows live in the database shared by every board of one owner.

Isolation still holds where it matters. Between owners it is absolute — one
person's messages are in another file entirely. And it holds around everything
that is *not* a message: conversations, artifacts and a board's own SQL tables
never leave the board they belong to.

### Both sides sit on one runtime server

The messages live with the runtime that took them in, so a board reaching them
is a board on that same server. This is the locality rule
[Conversations](./conversations.md) and [SQL](./sql.md) already have, not a new
one: a board name means one database *per server it runs on*.

Two units that talk therefore sit on one runtime server for now. Reaching a
queue on another one is a job for the coordinator, which already holds a
credential for every runtime of a board — a service inside a runtime holds none,
and giving it one is the wrong shape.

**Publish before you commit.** The one thing a board has to get right. A publish
that fails passes nothing on and stops the pipeline, so the state change that
says the message was sent must come *after* it. Ordered that way, a failed
publish leaves the board where it was and the next tick sends it again — the
board's own timer is the retry, which is why the framework needs no outbox.

### Nobody dispatches

There is no delivery loop and no router. A board **pulls**: put a `consume` in a
pipeline that a [Timer](./timer.md) drives, exactly as a board polls anything
else, and pair it with [Iterator](./iterator.md) to act on the messages one at a
time.

This is deliberate. A queue that pushed would be a wire between boards, and
wires are what the ordered service list exists to avoid. What a queue adds is
not routing but time.

---

## Modes

| Mode | What it does | Emits |
|---|---|---|
| `publish` (default) | Puts one message on a topic | the message as stored |
| `consume` | Claims the messages that may be worked on now | `{ messages: [...], count }` |
| `ack` | Closes a claimed message: the work is done | `{ id, status, attempts }` |
| `fail` | Hands a claimed message back, or buries it | `{ id, status, attempts }` |
| `list` | Reads the log without claiming anything | `{ messages: [...], count }` |

---

## The guarantee: at-least-once, and the board says when

`consume` claims a message for `visibilitySeconds` and hands it on. The pipeline
does the work. An `ack`, placed where success is actually known, closes it.

Anything that stops in between — a crash, a send that failed, a runtime
restarted mid-flight — leaves the claim to expire, and the message is handed out
again. That is the honest guarantee for work driven by mail: **the same enquiry
twice is a nuisance; an enquiry lost is a customer.**

A claim is therefore a deadline, not a lock. A runtime that dies holds nothing,
and no one has to release anything on its behalf.

A message handed out `maxAttempts` times without an acknowledgement stops being
retried and is marked `dead`, where it stays readable — with the attempt count
and the reason — rather than disappearing. `fail` on a message that has already
used up its attempts buries it immediately, instead of handing it out once more
only to bury it on the next pass.

**Acked messages are kept.** A queue that deletes on ack can answer "what is
pending" and nothing else, while the question actually asked when something has
gone wrong is *what did the other board send me an hour ago, and what did I do
with it*. `list` reads the whole log, claim state and attempt count included.

---

## Configuration

| Field | Default | What it does |
|---|---|---|
| `mode` | `publish` | See the mode table |
| `topic` | — | The name the two boards agreed on. Required by `publish` and `consume`; an optional filter for `list` |
| `payloadFrom` | `""` | Dotted path to the part of the input to send. Empty sends the whole input |
| `idFrom` | `id` | Where `ack` and `fail` find the message id in their input |
| `limit` | `10` | How many messages one `consume` claims, or `list` returns |
| `visibilitySeconds` | `300` | How long a claim holds before the message is handed out again |
| `maxAttempts` | `5` | Hand-outs without an ack before the message is left alone |
| `status` | `""` | Filter for `list`: `pending`, `claimed`, `done`, `dead` |

| | |
|---|---|
| **Input** | whatever is being sent (`publish`), or a claimed message (`ack`, `fail`) |
| **Output** | see the mode table above |
| **Arrays** | a published array is **one** message, not many |
| **Binary** | not accepted |

A published array stays one message on purpose. What a board sends is what the
other board reads, and a producer that meant several says so with an
[Iterator](./iterator.md) — splitting here would make the count depend on the
shape of a payload the queue is supposed to know nothing about.

Anything that goes wrong is reported as `{ error }` and **passes nothing on**.

---

## Where it lives

One file per owner, beside the per-board databases:

```
~/.hkp/node/db/<sha256(owner)>/shared.db
```

`HKP_DB_DIR` moves the root; `HKP_DB_DIR=""` keeps everything in memory, which
is what a throwaway run wants.

---

## Example

The booking board, having understood an enquiry, sends it on:

```json
{
  "uuid": "hand-over",
  "serviceId": "queue",
  "serviceName": "Queue",
  "state": {
    "mode": "publish",
    "topic": "booking.ready",
    "payloadFrom": "extraction"
  }
}
```

The hotels board picks it up on its own clock, acts on it, and closes it:

```json
[
  { "uuid": "tick", "serviceId": "timer",
    "state": { "periodic": true, "periodicValue": 30, "periodicUnit": "s", "running": true } },

  { "uuid": "incoming", "serviceId": "queue",
    "state": { "mode": "consume", "topic": "booking.ready", "limit": 5 } },

  { "uuid": "per-request", "serviceId": "iterator",
    "state": { "itemsFrom": "messages",
               "pipeline": [ "…find hotels, draft the enquiry…",
                 { "uuid": "done", "serviceId": "queue",
                   "state": { "mode": "ack", "topic": "booking.ready" } } ] } }
]
```

The `ack` sits **last**, after the work — that placement is the guarantee. Put
it directly after the `consume` and a failure downstream loses the request
silently.

---

## Testing a board on its own

Because a topic is just a name, nothing has to exist on the other side. Publish
a message by hand — an [Injector](./injector.md) into a `publish`, or the
service's own panel — and the consuming board runs as if the producer were
there. A board that consumes a topic nobody publishes to reads zero messages and
reports no error, which is what makes it loadable and testable alone.
