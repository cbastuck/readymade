# Store

What a board remembers between runs — keyed, durable, and scoped to the board.

---

## Available in

| Runtime | Service ID |
|---|---|
| Node.js (hkp-node) | `store` |

---

## What it does

Store keeps records for one board and hands them back later. Each record has a
key, a value, and the times it first arrived and was last written.

It is deliberately **not a database**. It is the missing half of two patterns
that otherwise cannot be expressed in a single board:

- **Dump cheaply, process expensively.** Something arrives, is stored, and costs
  nothing more. A timer later reads the batch and does the expensive work once.
  Without somewhere to put it, the only choices are to process every arrival
  the moment it lands, or to lose it.
- **Work that outlives whoever started it.** Somebody clicks a button, a model
  takes a minute, and they close the tab. The answer lands here, and is still
  here when they come back.

### Which records a `store` sees

Records belong to **the board, and the tenant that owns it**. Both come from the
runtime rather than from the service's configuration — a service is told its own
state and nothing about who asked for it, so a board cannot widen its own scope
by asking. Two runtimes of one board share one table; two boards do not, and two
people never do.

This is why **every `store` on a board reads and writes the same records without
being configured to.** A board with three of them — one writing, one listing,
one releasing — needs no shared identifier, because there is nothing to
identify: `key` names a *record within* a table, never the table itself.

Nesting does not change it either: a `store` inside a `sub-service` sees the
same table as one beside it.

### More than one table on a board

`namespace` subdivides the board's table. Leave it empty — the default — and
there is one table, which is what most boards want. Set it where a board keeps
two unrelated sets of things that would otherwise arrive in one `list`:

```json
{ "serviceId": "store", "state": { "mode": "put",  "namespace": "enquiries" } },
{ "serviceId": "store", "state": { "mode": "list", "namespace": "enquiries" } },
{ "serviceId": "store", "state": { "mode": "list", "namespace": "invoices"  } }
```

A namespace only ever *narrows* what the runtime already granted, so unlike the
tenant and the board it is safe for a board to choose. Clearing one namespace
leaves the others alone, and clearing the board's own table leaves every
namespace in it untouched.

---

## Modes

| Mode | What it does | Emits |
|---|---|---|
| `put` (default) | Writes a record | `{ key, value, createdAt, updatedAt }` |
| `get` | Reads one back | the record, or **nothing at all** on a miss |
| `list` | Every record of the board, oldest first | `{ records: [...], count }` |
| `delete` | Removes one | `{ key, deleted }` |
| `clear` | Empties the board's table | `{ cleared }` |
| `release` | Lets picked records through and forgets them | one pass **per record** |

**A `get` miss stops the pipeline.** That is the cache signal: whatever follows
is the "go and fetch it" path, so it runs only when the lookup found nothing.

```
store (get) → http-client (fetch it) → store (put) → ...
```

---

## The human checkpoint

`release` is how a person decides what gets processed. It takes a list of keys,
sends each of those records down the rest of the pipeline **one pass at a
time**, and removes them from the store. Everything else stays exactly where it
was — the queue is what has *not* been dealt with.

It runs from `configure` as well as from an input, because a facade button can
only configure a service; it does not start a pipeline pass. So a panel is:

```json
{ "type": "data-table", "source": { "serviceUuid": "queue", "path": "records" },
  "selectable": true, "rowKey": "key", "selectionState": "picked" },
{ "type": "button", "label": "Process selected",
  "action": { "serviceUuid": "approved",
              "configure": { "keys": { "$state": "picked" } } } }
```

One pass per record rather than one batch: what follows an approval is per-item
work — read this document, write this row — and a board should not have to
unpack a batch to do it.

`keys` is never reported in `getState`, so a saved board cannot carry a stale
list that would release again the next time it is opened.

**Approving is final.** A released record is gone from the store, so if the
pipeline behind it fails, it is not waiting to be retried. Retry and
dead-lettering are a separate concern; until they exist, treat approval as a
commitment.

Records already dealt with are passed over without complaint — two people
looking at the same queue is the normal case, not an error.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `mode` | `string` | `"put"` | One of the six above |
| `namespace` | `string` | `""` | Which of the board's tables. Empty is the board's own |
| `key` | `string` | `""` | The key to act on, when every pass means the same slot |
| `keyFrom` | `string` | `""` | Dotted path into the input to take the key from, e.g. `meta.messageId` |
| `valueFrom` | `string` | `""` | Dotted path to the part worth keeping; the whole input by default |
| `limit` | `number` | `0` | `list`: how many records to take, oldest first. `0` = all |
| `keys` | `string[]` | — | `release`: the records to let through. Write-only; accepts keys or whole records |
| `lastCount` | `number` | — | Read-only: what the last pass saw |

**Where the key comes from**, in order: `keyFrom` if it leads anywhere, then a
`key` field on the input, then a bare string input (for a lookup), then the
configured `key`. A `put` with no key at all gets one that sorts by when it was
made, so an unnamed dump keeps its arrival order.

An input shaped `{ key, value }` is understood as a record handed over as one:
the wrapper is not what gets stored.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | anything to keep (`put`), or the key(s) to act on (`get`, `delete`, `release`) |
| **Output** | see the mode table above |

**The outcome is pushed, not returned.** The disk answers asynchronously and
the pipeline does not wait, so the service returns nothing, stops the push, and
calls the rest of the pipeline itself once the record is written or read (the
same inversion-of-control path `http-client` takes). For a board this is
invisible.

Anything that goes wrong — an unwritable directory, a missing key on a mode that
needs one — is reported as `{ error }` and passes nothing on. A board that
carried on here would be acting on a record that was never written.

---

## Where it lives

Records are one JSON file each, under a directory the runtime owns:

```
~/.hkp/node/store/<sha256(owner)>/<sha256(board)>/[<sha256(namespace)>/]<sha256(key)>.json
```

A namespace is a directory *inside* the board's own, so the board's default
table keeps the path it always had, and a namespaced one cannot be reached from
outside the board. Records are files ending in `.json` and namespaces are
directories, so listing one never sees the other.

Set `HKP_STORE_DIR` to move it. `HKP_STORE_DIR=""` keeps records **in memory**
— they last as long as the process and no longer, which is what tests and
throwaway runs want.

The names in that path are derived, never used directly: every part of it comes
from outside, so a key called `../../etc/passwd` cannot escape the root, and
`Key` and `key` — two keys here — cannot become one file on a case-insensitive
filesystem. The real names are inside the file.

Records carry whatever a board put in them, which for these workflows is
correspondence — so directories are `0o700` and files `0o600`, the owner's to
read and nobody else's. Writes go to a temporary name and are renamed into
place, so a crash mid-write costs the record being written rather than the
table.

---

## Example

The attached demo board is the cheap-dump loop end to end: a webhook drops
enquiries in without processing them, and a timer picks up the batch later.

```json
{
  "node": [
    { "serviceId": "http-server-subservices", "state": { "pipeline": [
      { "serviceId": "store", "state": { "mode": "put", "keyFrom": "body.id" } }
    ] } },
    { "serviceId": "timer", "state": { "mode": "periodic", "intervalMs": 60000 } },
    { "serviceId": "store", "state": { "mode": "list", "limit": 10 } },
    { "serviceId": "monitor" }
  ]
}
```

POST an enquiry to the mount and nothing expensive happens. A minute later the
batch is there to work through.
