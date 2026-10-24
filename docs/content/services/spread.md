# Spread

Sends each item of an array on by itself — one value in, as many out as it has items.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/spread` |

---

## What it does

A pipeline pass carries one value, and so does a value leaving a runtime: an
array of a hundred chunks crosses to the next runtime as **one** message, as
large as the file it was cut from. Spread sends each item down the rest of the
board on its own — the services after it, and the runtimes after this one — so
each crosses as a message of its own.

That is what gets a large value past a coordinator's frame limit
(`HKP_COORDINATOR_MAX_FRAME_BYTES`): a [File Source](./file-source.md) with a
`chunkSize` cuts a file into an array of pieces, Spread sends each piece as its
own frame, and a [Gather](./gather.md) on the far side puts them back together.

```
ui:   file-source (chunkSize) → spread     one value per chunk
node: gather → …                           one value per file
```

### Not an Iterator

An [Iterator](./iterator.md) runs a pipeline of its own once per item and comes
back with the answers, so one value still leaves it. Spread holds no pipeline:
what follows it on the board is what each item goes through, and nothing comes
back. It returns `null` and continues the run itself, once per item — the
[pull pattern](../concepts/runtime.md) — so every item goes on in the run that
reached it, with the caller that run carries.

### Each item goes on wrapped

Every item is sent as

```json
{ "item": "…the item, untouched…", "group": "<id per array>", "index": 0, "total": 4 }
```

`group` is the same for every item of one array and different for the next;
`index` and `total` say where the item sat. That is what a Gather needs to put
the array back in order once it has seen every part. A service in between reads
the item as `params.item`.

### A single item is an array of one

As for an Iterator: a non-array input is sent on as one part with `total: 1`,
so a board fed sometimes one value and sometimes several does not change shape.
Nothing (`null`, or an empty array) sends nothing on.

### Items go on in order

Each item is sent on and the services after Spread awaited before the next one
goes, so they see the items in order and a hundred chunks are not all in flight
at once. Order across a runtime boundary is not something a Gather relies on —
it orders by `index`.

### Where to put it on a deployed board

Put Spread in the browser runtime **where the run begins** — the one a facade
control or a picked file starts. A browser runtime that the coordinator calls
into, because a runtime before it produced something, answers the coordinator
once per call, so only the first item would go on from there.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `itemsFrom` | `string` | `""` | Dotted path to the array in the input; the input itself by default |
| `lastTotal` | `number` | — | Read-only: how many items the last array had |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | `JSON` — an array, or a single item (any type) |
| **Output** | `JSON` — one `{ item, group, index, total }` per item, each sent on by itself; `Null` from the service's own pass |

---

## Typical uses

- Getting a file past the frame limit: File Source (`chunkSize`) → **Spread** → hkp-node Gather (`join`) → …
- Handling query rows one by one further down the board: … → **Spread** (`itemsFrom: "rows"`) → Map (`params.item`) → …
