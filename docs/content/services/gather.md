# Gather

Waits for every part a Spread sent on and turns them back into one value — as an array, or as whatever its nested pipeline makes of them.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `gather` |
| Node.js (hkp-node) | `gather` |
| Python (hkp-python) | `gather` |
| C++ (hkp-rt) | `gather` |

Put it in whichever runtime the whole is wanted in — the browser, when a server
spread a result for a panel to show; hkp-node, when a browser spread a file for
an import.

---

## What it does

Gather is the other half of [Spread](./spread.md). Spread turns one array into
as many values as it has items, each sent on by itself; Gather waits until it
has seen them all and turns them back into one.

```
ui:   file-source (chunkSize) → spread     one value per chunk
node: gather → measure                     one value per file
```

What makes that worth doing is the space between the two. A value leaving a
runtime travels as one message, and a coordinator drops a message above its
frame limit (`HKP_COORDINATOR_MAX_FRAME_BYTES`) and logs it as `frame-dropped`.
A file too large to send at once can still be sent as chunks, each under the
limit, and arrive whole. `boards/frame-limit-test-board.json` shows both.

### A part says which whole it belongs to

Spread sends each item as `{ item, group, index, total }`. Gather collects the
parts of one `group`, puts each at its `index`, and once it holds `total` of
them the group is complete. Parts may arrive in any order; a part sent twice
counts once.

Until a group is complete Gather passes **nothing** on (`null`): the run that
brought the part ends there. The run that brings the last part is the one the
whole goes on in.

**Anything that is not a part passes through untouched**, so the same Gather
sits on a board that sometimes sends a value whole.

### What the group becomes

With no `pipeline`, the items go on as an array, in the order they were spread.

With one, the pipeline is given `{ group, items }` and its answer is what goes
on — the same arrangement as the reducer of [Tracks](./tracks.md): a pipeline,
not a list of strategies. Joining text is one [Map](./map.md) term:

```json
{
  "uuid": "gather",
  "serviceId": "gather",
  "state": {
    "pipeline": [
      {
        "uuid": "join",
        "serviceId": "map",
        "state": { "mode": "replace", "template": { "=": "join(params.items, '')" } }
      }
    ]
  }
}
```

A pipeline that stops — returns `null` — stops Gather too. The pipeline runs as
a run of its own beneath the one that brought the last part, like a
[SubService](./sub-service.md)'s.

### Collecting holds the group in memory

Which is what a frame limit set to bound memory would otherwise have prevented.
So a group is bounded, and one that never completes is let go:

- **`maxBytes`** — a group whose parts add up to more is refused: what it held
  is dropped, the parts still on their way are ignored, and the board log
  records `gather.refused`.
- **`timeoutMs`** — a group still incomplete that long after its first part is
  let go, logged as `gather.timed-out`. Checked whenever a part arrives.

Either way `error` says what happened, in the service's state and as a
notification — a facade `notice` on `error` shows it — because a group that
never arrives looks, from outside, exactly like nothing having been sent.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `pipeline` | `array` | `[]` | The nested services that make one value of `{ group, items }`; none passes the items on as an array |
| `maxBytes` | `number` | `67108864` | The most one group may hold (64 MiB, the coordinator's default frame limit) |
| `timeoutMs` | `number` | `60000` | How long a group may take to complete |
| `bypass` | `boolean` | `false` | Pass every input through untouched |
| `stopPropagation` | `boolean` | `false` | Pass nothing on, even a complete group |
| `pending` | `number` | — | Read-only: how many groups are incomplete |
| `error` | `string` | `""` | Read-only: the last group refused or let go, and why |

Each part that arrives notifies `{ group, received, total, pending }`.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | `JSON` — a part, `{ item, group, index, total }`, as a Spread sends it; anything else passes through |
| **Output** | `JSON` — the group's items as an array, or what the pipeline made of them (e.g. a `String`); `Null` until the group is complete |

---

## Typical uses

- A file past the frame limit: Browser File Source (`chunkSize`) → Spread → **Gather** (Map `join(params.items, '')`) → SQL import
- Collecting what a Spread sent through other services back into one list: … → Spread → Map (`overwrite` mode, rewriting `item` and keeping the rest of the part) → **Gather** → …
