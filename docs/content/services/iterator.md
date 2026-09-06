# Iterator

Runs a nested pipeline once per item. Iteration you can see in the board.

> Not to be confused with the browser's [Looper](./looper.md), which records a
> stream of values and replays them at their original timing. Different idea,
> similar-sounding name.

---

## Available in

| Runtime | Service ID |
|---|---|
| Node.js (hkp-node) | `iterator` |

---

## What it does

A pipeline pass carries **one** value. That is a problem for anything producing
several — a poll finding four conversations, a query returning twenty rows.

Without Iterator there are only bad answers. Hand the whole array to the next
service, and it — and everything after it — has to loop internally. Or let the
service that found the items call the rest of the pipeline itself, which buries
iteration inside whichever service happened to need it first, where no other
service can reuse it and nobody reading the board can see it.

Iterator is the third answer. The service that produced the array says only what
it found; iterating over it is a service of its own, sitting in the board where
you can see it.

```
timer → conversations (actionable) → iterator ┐
                                              ├─ text-generation  (decide)
                                              └─ conversations    (transition)
```

The timer ticks once. The two services **inside** the Iterator run once per
waiting conversation.

### A single item is an array of one

An input that is not an array is iterated as a list with one element. A board
that grows from "the one that arrived" to "the four that were waiting" does not
change shape, and neither does one fed by something that sometimes returns a
single row.

An object counts as one item, not as its values.

---

## What comes back

The results of each pass, as an array.

**An item whose pipeline stopped contributes nothing.** `null` means *nothing to
pass on* here exactly as it does everywhere else, so a sub-pipeline shaped like
a filter makes the Iterator a filter:

```
iterator ┐
         ├─ map      (work out whether this one matters)
         └─ filter   (null for the ones that do not)
```

**Nothing collected at all stops the outer pipeline.** No items, or every item
stopped, and nothing is passed on — rather than continuing with an empty array.

### One item at a time

Items are taken in turn, each awaited before the next begins. A pass that calls
a model is then one request in flight rather than ten at once, which is what an
inference provider's rate limit wants. The cost is that a poll takes as long as
its items put together — ten conversations at twenty seconds each is a
three-minute pass.

Because the runtime awaits, a service that takes its time is still just a
service: what follows it in the nested pipeline runs with its answer, and a
[Join](./join.md) around it carries the item past it.

---

## One item failing does not end the loop

Nine conversations should not go unprocessed because the tenth had a malformed
address. A pass that throws is counted and reported, and the loop carries on.

Every pass reports `{ items, results, failed }`, and the same counts are
readable as `lastItems` / `lastFailed` — so an Iterator that is quietly losing
items is visible rather than silent.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `pipeline` | `array` | `[]` | The nested services, in order |
| `itemsFrom` | `string` | `""` | Dotted path to the array in the input; the input itself by default |
| `limit` | `number` | `0` | Take at most this many items. `0` = all |
| `bypass` | `boolean` | `false` | Pass the input through untouched |
| `lastItems` | `number` | — | Read-only: how many the last pass iterated |
| `lastFailed` | `number` | — | Read-only: how many of those threw |

`itemsFrom` is how an Iterator reaches into a result that says more than the
list itself. [Conversations](./conversations.md)' `actionable` answers
`{ conversations, count }` rather than a bare array, so that it can say how many
it found; `itemsFrom: "conversations"` takes the list out of it without the
service having to flatten its answer for whatever comes next.

An Iterator with an empty pipeline, or one that is bypassed, passes its input
straight through — the same thing an empty SubService does, so a half-built
board stays legible rather than going quiet.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | an array, or a single item |
| **Output** | the collected results, or **nothing at all** when none were collected |

---

## Runs and logs

Each item runs as a **run of its own**, descended from the run that reached the
Iterator. Without that, ten items processed on one timer tick would all be
logged as that one tick, and *what happened to this one* would be unanswerable.
With it, each item's journey through the nested pipeline is its own trace with
the tick as its parent.

Nested services log to the board's log like any other, and report their
notifications out through the Iterator.

---

## Example

Acting on every conversation waiting for a decision:

```json
{
  "uuid": "per-conversation",
  "serviceId": "iterator",
  "serviceName": "Iterator",
  "state": {
    "itemsFrom": "conversations",
    "pipeline": [
      {
        "serviceId": "conversations",
        "uuid": "read-thread",
        "state": { "mode": "thread" }
      },
      {
        "serviceId": "text-generation",
        "uuid": "decide",
        "state": { "backend": "server", "model": "…" }
      },
      {
        "serviceId": "conversations",
        "uuid": "record-decision",
        "state": {
          "mode": "transition",
          "states": ["init", "waiting-approval", "waiting-reply", "done"]
        }
      }
    ]
  }
}
```
