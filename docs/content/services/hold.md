# Hold

Keeps the latest value one side of a pipeline produced, and replays it to the other side.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/hold` |
| hkp-node | `hold` |
| hkp-python | `hold` |
| hkp-rt | `hold` |

---

## What it does

A pipeline is one ordered list, but it can be entered from more than one side. A timer
inside an [`http-server-subservices`](./http.md) drives it on its own schedule; an HTTP
request arriving at the same service drives it whenever the caller shows up. The two are
unrelated in time, so the value the producer made is gone by the time the consumer asks
for it.

Hold keeps it. **Which side is calling can be said two ways**, and a board picks one.

### By declaring the role

With a `slot`, the board says outright which end each Hold is: `op` is `"write"` or
`"read"`, and two Holds naming one slot are the two ends of it.

- A **write** stores its input and **emits it unchanged**, so the pass it belongs to
  carries on as though the Hold were not there.
- A **read** emits what is held, **raw** — not wrapped in anything — so it can be the
  whole of what a pipeline answers with. While nothing is held it returns `null` and the
  pipeline stops there.

Nothing inspects the value, so anything can be held: bytes, a rendered document, an audio
buffer. And the two ends may sit in **pipelines that never meet**, which is what an
endpoint's [entry points](./http.md#the-two-ways-in) are:

```json
{
  "onProcess": [ { "serviceId": "hold", "state": { "slot": "document", "op": "write" } } ],
  "onRequest": [ { "serviceId": "hold", "state": { "slot": "document", "op": "read"  } } ]
}
```

Where the cells live is the **host's** to decide. A service that owns several pipelines
lends them one store of its own — so an endpoint's slot names are private to it, and two
endpoints on a runtime may both call a slot `document`. Anything else falls through to the
runtime's.

### By what the value carries

With a `property` and no slot, the input says which side called:

- An input **carrying that property** is the producer. Its value replaces what is held.
- **Every** call — that one included — emits the held value under the same property name.
- While nothing is held, every call returns `null` and the pipeline stops there.

So the services after Hold receive the same shape whichever side called, and cannot tell
the two apart. That is the point: the ordered list itself cannot say where a call came
from, and with Hold in front of them nothing downstream needs to.

This is the only arrangement available where **both sides share one pipeline**, since
position says nothing there and the value is all there is to go on. Its limit is the other
side of the same coin: two sides whose values look alike cannot be told apart — a response
envelope and a request are both `{meta, …}` — and a value with no properties at all, raw
bytes, always reads.

Everything but the held property is dropped. A producer emitting
`{ triggerCount: 5, note: "x" }` with `property: "triggerCount"` leaves Hold as
`{ triggerCount: 5 }`, and so does a request that carries no `triggerCount` at all.

An input that cannot carry a property — a string, a number, an array — is a read. So is one
carrying the property as `null`: a null held value is an empty one, the way null is nothing
to pass on everywhere else, so a producer cannot hold null. Holding non-JSON values is not
supported yet.

While `property` is unset, Hold holds nothing and passes its input through unchanged.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `slot` | `string` | `""` | The cell to hold in. Set, `op` says which end this Hold is and the value is not inspected. |
| `op` | `"read"` \| `"write"` | `"read"` | Which end. Only read with a `slot`. |
| `property` | `string` | `""` | The property to hold, when there is no slot. An input carrying it writes; every call reads. |
| `action` | `"clear"` | — | Forgets the held value and resets the counts. |

State reports the arrangement in use and not the other one, so a board keeps only the
fields it acts on.

Changing `property` does the same, since the held value belonged to the old name. The counts
go with the value either way: they say how often each side has called for what is held now.

Reported state also carries `held` — `null` while nothing is held — along with `readCount`
and `writeCount`, so a producer that has stopped writing shows up as reads without writes.
A held value that is bytes, or simply large, is **described** in `held` rather than sent
(`"[4096 bytes]"`): state is read back into the board and sent to everyone watching, so
what goes in it has to be worth carrying. The value itself is untouched.

Destroying a Hold empties only what it held itself. A slot belongs to the host and the
other end of it outlives this one — a pipeline rebuilt while a board is running destroys
the services in it, and that must not empty a cell the other side is still answering from.

Bypassing Hold in hkp-rt passes the input straight through without holding or replaying —
the base class does not call the service at all.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any. With a `slot`, `op` decides; otherwise an object carrying the configured property writes and anything else reads. |
| **Output** | With a `slot`: a write emits its input unchanged, a read emits the held value raw. Otherwise `{ <property>: <held value> }`. `null` while nothing is held. |

---

## Typical uses

**An endpoint that publishes a document.** The board builds it, the endpoint serves it,
and neither pipeline looks at what it is:

```
sql → map → HttpServerSubservices
              ├─ onProcess: Hold (slot: document, op: write)
              └─ onRequest: Hold (slot: document, op: read)
```

An endpoint that answers with whatever a producer last made. The timer drives
`Timer → Hold → Map` on its own; a request enters the same pipeline at the head, the timer
passes it through, and Hold turns it into the last tick so the Map formats the answer:

```
HttpServerSubservices
  └─ onRequest: Timer → Hold (property: triggerCount) → Map
```

Here the two sides share one pipeline — the timer drives it, and a request enters it at the
head — so the property is what tells them apart. The same board with the producer outside
the endpoint, using [`pipeline`](./http.md#the-two-ways-in) so a pass of the chain runs the
same list a request does:

```
Timer → Map → HttpServerSubservices
                └─ pipeline: Hold (property: triggerCount)
```

Put Hold **before** the services that reshape the value, not after — those services are
exactly what should not have to know which side called.


---

## Where its cells live

A slot is a name, not a store. Which cells that name reaches is decided by whatever holds
the pipelines — never by Hold itself, which is what lets the same board mean the same thing
wherever it runs.

| Holding it | Which cells |
|---|---|
| The runtime | Every service in it shares one set, so two Holds naming `document` meet. |
| An endpoint ([`http-server-subservices`](./http.md)) | Its own, shared by its two entry pipelines — so two endpoints on a runtime may both call a slot `document` without meeting. |
| A [scope](../concepts/scopes.md) (`sub-service`) | Its own by default, or the runtime's with `scope: { slots: "inherit" }`. |
| Nothing | A Hold that reaches no store still holds, for itself alone, rather than dropping what it was given. |

The default is worth saying plainly: **a scope keeps its cells to itself**. A reusable
sub-pipeline whose slot names leaked into its surroundings would collide with a second copy
of itself, so two Holds that must meet across a scope boundary need that boundary to say
`inherit` — which the **Hold across scopes** demo board
(`hkp-frontend/boards/hold-scopes-demo-board.json`) does on both of its scopes.

The demo board linked from this page is the other arrangement: one endpoint
whose two entry pipelines share the cells it owns.
