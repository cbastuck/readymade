# Conversations

Mail arrives in threads, threads are in states, and work produced along the way
has to be found again. This service owns all three.

---

## Available in

| Runtime | Service ID |
|---|---|
| Node.js (hkp-node) | `conversations` |

---

## What it does

Conversations is the domain half of a pair. [SQL](./sql.md) knows SQL and nothing
else; this knows what a conversation *is*, and owns three tables that say so:

| Table | Holds |
|---|---|
| `conversation` | one per thread: its state, subject, participants, and when it last moved |
| `email` | every message, inbound and outbound, filed under its conversation |
| `artifact` | anything the workflow produced — a draft reply, an extraction, a booking |

A board that wants exactly these tables uses this. A board that wants different
ones uses [SQL](./sql.md) and writes them itself.

Both share one database per board, so a `sql` service beside a `conversations`
one can query these tables directly — for a report the modes below do not cover.

---

## Threading

**A conversation's id is the message id that began it**, worked out from mail
headers alone:

1. the conversation of any message already known from this one's `In-Reply-To`
   or `References` chain, most specific first; failing that
2. the oldest entry in that chain — so two replies to a root nobody ever saw
   still land together; failing that
3. the message's own id, because it is the first of its thread.

Deterministic, and no board configures it.

The cost of choosing headers over a subject-and-sender heuristic is real: a
correspondent whose client drops `References` starts a new conversation. That is
wrong, but wrong in the direction that leaves two threads to merge rather than
two customers' bookings in one thread.

### A message seen twice is not an event

A mailbox poll re-delivers. The second delivery **stops the pipeline** — the
same signal a [Store](./store.md) `get` miss gives — so the mail loop is safe to
run on a timer without the board having to remember what it has seen.

---

## States are the board's

The service does not know what `waiting-approval` means, and does not ship a
state machine. The board declares its states, and every transition is checked
against that list:

```json
{ "mode": "transition", "states": ["init", "waiting-approval", "waiting-reply", "done"] }
```

A state that is not on the list is **refused, not written**. That guard exists
because of what usually writes a transition: a model deciding the next step. A
state nothing selects on is indistinguishable from a conversation nobody is
working on any more — the failure would surface as silence, days later.

Leaving `states` empty accepts anything.

Artifact statuses are deliberately *not* checked the same way. A status is set
by a person pressing a button whose payload the board fixed, so a wrong value is
a board bug that shows up the first time anyone presses it.

---

## Modes

| Mode | What it does | Emits |
|---|---|---|
| `ingest` (default) | Files an email under its thread | `{ conversationId, state, isNew, participants, email }`, or **nothing** if already known |
| `thread` | The conversation's emails, oldest first | `{ conversationId, emails: [...], count, lastInbound }` |
| `transition` | Moves a conversation to another state | `{ conversationId, state, previous, updatedAt }` |
| `actionable` | Conversations a poll should act on | `{ conversations: [...], count }` |
| `put-artifact` | Keeps something the workflow produced | the artifact |
| `list-artifacts` | Artifacts, oldest first | `{ artifacts: [...], count }` |
| `set-artifact-status` | Records what was decided about one | the artifact |

### Acting on what `actionable` found

Whatever acts on a conversation acts on a **single** one — it reads the thread,
decides, and writes back. But `actionable` says only what it found; iterating
over it is [Iterator](./iterator.md)'s job, so a board can see the loop rather
than have it buried in this service.

```
timer → conversations (actionable, inState: ["init"]) → iterator ┐
                                                                 ├─ conversations   (thread)
                                                                 ├─ text-generation (decide)
                                                                 └─ conversations   (transition)
```

Point the Iterator at the list with `itemsFrom: "conversations"`. Each
conversation then runs the nested pipeline once, as a run of its own.

`idleSeconds` is what stops a poll picking the same conversation up on every
tick while the last decision is still being carried out.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `mode` | `string` | `"ingest"` | One of the seven above |
| `states` | `string[]` \| `string` | `[]` | The declared state machine. Empty accepts anything |
| `initialState` | `string` | `"init"` | What a newly threaded conversation starts in |
| `direction` | `string` | `"inbound"` | `ingest`: `inbound` or `outbound`, unless the input says |
| `state` | `string` | `""` | `transition`: a fixed target, for a step that always moves the same way |
| `stateFrom` | `string` | `"state"` | `transition`: dotted path to the target in the input |
| `conversationFrom` | `string` | `""` | Dotted path to the conversation id, e.g. `meta.conversationId` |
| `inState` | `string[]` \| `string` | `[]` | `actionable`: which states count as work. **Required** |
| `idleSeconds` | `number` | `0` | `actionable`: only conversations untouched this long |
| `limit` | `number` | `100` | How many rows to take |
| `kind` | `string` | `""` | Artifacts: the board's word for what this is |
| `status` | `string` | `"pending"` | Artifacts: the status to write, or to filter on |
| `payloadFrom` | `string` | `""` | `put-artifact`: dotted path to the part worth keeping |
| `idFrom` | `string` | `""` | `set-artifact-status`: dotted path to the artifact id |
| `lastCount` | `number` | — | Read-only: what the last pass saw |
| `error` | `string` | — | Read-only: why the last pass produced nothing |

**`lastInbound`** is the last message someone sent *to us*, separately from the
list. A reply goes to whoever wrote in, and taking the last email instead is
right only until we have sent one ourselves — at which point a board would
quietly address its reply to its own sending address. It is `null` on a thread
with nothing inbound in it.

**`idFrom`** is for marking an artifact after acting on it. A pass that has just
sent a message carries what was sent, not the draft it was sent from, so the
board says where to look — `approved.artifacts.0.id`. Without it, the id has to
be the input's own `id`, which means a Map reshaping the record purely to
satisfy the next service.

**Where the conversation id comes from**, in order: `conversationFrom` if it
leads anywhere, then a `conversationId` field on the input, then a bare string
input. `transition` takes its target state from `state` if the board fixed one,
otherwise from `stateFrom` on the input.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | an email envelope (`ingest`), otherwise a conversation or artifact id |
| **Output** | see the mode table above |

`ingest` accepts exactly what [IMAP Email](./imap-email.md) emits —
`{ messageId, subject, from, to, date, references, inReplyTo, text }` — with no
mapping in between. `from`/`to` are the envelope's names and stay the envelope's
names on the way out.

Anything that goes wrong — an unknown conversation, an undeclared state, an
`actionable` with nothing to poll for — is reported as `{ error }` and **passes
nothing on**.

---

## Where it lives

The same file per board as [SQL](./sql.md):

```
~/.hkp/node/db/<sha256(owner)>/<sha256(board)>.db
```

The tables are created on first use. Deleting the file starts the board over;
copying it takes that board's correspondence and nothing else.

---

## Example

Mail in, threaded and queued for a decision:

```json
{
  "uuid": "file-mail",
  "serviceId": "conversations",
  "serviceName": "Conversations",
  "state": { "mode": "ingest", "initialState": "init" }
}
```

Keeping a drafted reply for a person to look at:

```json
{
  "uuid": "keep-draft",
  "serviceId": "conversations",
  "serviceName": "Conversations",
  "state": {
    "mode": "put-artifact",
    "kind": "follow-up",
    "payloadFrom": "followUp",
    "status": "pending"
  }
}
```

And what the facade's `data-table` reads:

```json
{
  "uuid": "pending-drafts",
  "serviceId": "conversations",
  "serviceName": "Conversations",
  "state": { "mode": "list-artifacts", "kind": "follow-up", "status": "pending" }
}
```
