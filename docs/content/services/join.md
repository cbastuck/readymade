# Join

Splits off a piece of work and gets the answer back **beside** what you already
had, rather than instead of it.

---

## Available in

| Runtime | Service ID |
|---|---|
| Node.js (hkp-node) | `join` |

---

## What it does

Most services replace their input. `text-generation` answers with an answer, not
with the question and the answer. That is right for the service and wrong for the
pipeline around it: whatever the input was carrying — which conversation this is,
which record it came from — is gone by the time the answer arrives, and whatever
has to file the answer no longer knows where it belongs.

```
input ──┬──────────────────────────────► merged output
        └── nested pipeline ── result ──┘
```

The carrier never goes anywhere, because the nested pipeline is a **detour**
rather than the road.

The alternatives are all worse. Teaching every service to pass its input through
makes every output a pile of everything that ever touched it. Asking a model to
echo an id back makes correctness a matter of the model being careful. Keeping
the id somewhere on the side stops working the moment two runs overlap.

---

## A detour that takes its time

The runtime awaits every service, so a nested `text-generation` taking a minute
is waited for and its answer merged like any other. Nothing about a slow detour
needs saying in the board.

That is the reason the pipeline awaits at all. A service that answered late by
calling the rest of the pipeline itself left no input for anything to re-join
with — the question was gone by the time the answer existed.

---

## `as` is the safe way to use it

Naming a key puts the result there, and nothing the nested pipeline produces can
collide with what the input was carrying:

```json
{ "as": "extraction" }
```

```
in  { conversationId, emails }
out { conversationId, emails, extraction: { … } }
```

Merging at the top level is available for the cases where the two shapes are
known to be disjoint. Then `mode` decides a collision: `overwrite` (default)
lets the nested answer win, `add` protects what the input was carrying.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `pipeline` | `array` | `[]` | The detour, in order |
| `as` | `string` | `""` | Put the result under this key. Empty merges at the top level |
| `mode` | `string` | `"overwrite"` | Top-level merge only: `overwrite` or `add` |
| `bypass` | `boolean` | `false` | Pass the input through untouched |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | anything |
| **Output** | the input and the result together, or **nothing** when the detour produced nothing |

A nested pipeline that stops stops this one too. Continuing with the input alone
would hand the services downstream something indistinguishable from a merge that
worked — which is how an empty payload gets filed under a name claiming
otherwise.

A scalar or array on either side has no fields to combine: with `as` the input
is kept under `input`, and without it the half that has fields wins.

---

## Example

Asking a database a question about the record in hand, without losing the record:

```json
{
  "uuid": "with-history",
  "serviceId": "join",
  "serviceName": "Join",
  "state": {
    "as": "history",
    "pipeline": [
      {
        "serviceId": "sql",
        "uuid": "past-bookings",
        "state": {
          "mode": "query",
          "statement": "SELECT * FROM booking WHERE guest = $guest ORDER BY sentAt DESC LIMIT 5"
        }
      }
    ]
  }
}
```
