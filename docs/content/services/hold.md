# Hold

Keeps the latest value one side of a pipeline produced, and replays it to the other side.

---

## Available in

| Runtime | Service ID |
|---|---|
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

Hold keeps it. One property name is the whole configuration:

- An input **carrying that property** is the producer. Its value replaces what is held.
- **Every** call — that one included — emits the held value under the same property name.
- While nothing is held, every call returns `null` and the pipeline stops there.

So the services after Hold receive the same shape whichever side called, and cannot tell
the two apart. That is the point: the ordered list itself cannot say where a call came
from, and with Hold in front of them nothing downstream needs to.

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
| `property` | `string` | `""` | The property to hold. An input carrying it writes; every call reads. |
| `action` | `"clear"` | — | Forgets the held value and resets the counts. |

Changing `property` does the same, since the held value belonged to the old name. The counts
go with the value either way: they say how often each side has called for what is held now.

Reported state also carries `held` — `null` while nothing is held — along with `readCount`
and `writeCount`, so a producer that has stopped writing shows up as reads without writes.
A held value that cannot travel as JSON is described in `held` rather than sent; the value
itself is untouched. In hkp-rt everything held is already JSON, so that case does not arise.

Bypassing Hold in hkp-rt passes the input straight through without holding or replaying —
the base class does not call the service at all.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any. An object carrying the configured property writes; anything else reads. |
| **Output** | `{ <property>: <held value> }`, or `null` while nothing is held. |

---

## Typical uses

An endpoint that answers with whatever a producer last made. The timer drives
`Timer → Hold → Map` on its own; a request enters the same pipeline at the head, the timer
passes it through, and Hold turns it into the last tick so the Map formats the answer:

```
HttpServerSubservices (process_on_session)
  └─ Timer → Hold (property: triggerCount) → Map
```

The same board with the producer outside the endpoint, using
[`process_on_both`](./http.md) so data from the chain runs the nested pipeline too:

```
Timer → Map → HttpServerSubservices (process_on_both)
                └─ Hold (property: triggerCount)
```

Put Hold **before** the services that reshape the value, not after — those services are
exactly what should not have to know which side called.
