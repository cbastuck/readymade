# Tracks

Several pipelines over one input, and one answer out.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `tracks` |
| Node.js (hkp-node) | `tracks` |
| Python (hkp-python) | `tracks` |
| C++ (hkp-rt) | `tracks` |

---

## What it does

[Iterator](./iterator.md) runs one pipeline over many items. This is the other
half of that pair: many pipelines over one item.

```
input ──┬── track ── answer ──┬── reduce ── output
        ├── track ── answer ──┤
        └── track ── answer ──┘
```

A board that has to do two unrelated things with the same value — write it to a
table *and* tell somebody about it, ask three services and compare what they say
— could always fake this by putting those things in a row and teaching each of
them to pass its input through. That works, and records nothing: not that they
are siblings rather than a sequence, not in which order they may run, not which
of their answers matters. All three are this service's subject.

**Every track is given the same input**, and no track can see another's answer.
That is what lets a track be read on its own.

---

## The answers are an array, holes included

One element per track, in declaration order. A track that stopped — declined,
found nothing, failed — leaves `null` in its place rather than being left out,
so position still names the track that produced it and a missing answer is
visible rather than absent.

An array of nothing but nulls is still an array. This service never stops a
pipeline by itself; whether silence means stop is the reducer's to say:

```json
{ "=": "filter(params.results, 'item !== null').length ? params.results : null" }
```

That one is worth knowing, because tracks whose work is **asynchronous** answer
nothing on the pass that feeds them — an aggregator collecting over an interval,
a service that emits when a reply arrives. Their real output reaches the board
later, by the same route any autonomous emitter's does: it leaves through this
service and carries on down the pipeline. Without the reducer above, everything
after this service is also handed a row of nulls on every pass.

---

## `run` — one at a time, or all at once

```json
{ "run": "serial" }
```

`serial` is the default and the safe one: two tracks writing to the same table
are a race the moment they overlap, and concurrency should be asked for rather
than discovered. `parallel` is for tracks that spend their time waiting on
something else — an HTTP call, another runtime — where the waiting is the cost.

Either way the answers come back in **declaration order**. How they ran is not
something the next service should be able to tell.

**Runtime differences:** the browser and hkp-node overlap tracks under
`parallel`. hkp-python and hkp-rt process synchronously, so they record the
setting and still run one track at a time — a board says the same thing and gets
the same answers in every runtime; only the wall clock differs.

---

## `reduce` is a pipeline, not a list of strategies

Taking the first answer, merging them, keeping only what came in: each is one
`map` term, so there is nothing here to choose from and nothing to wait for
somebody to add. The reducer is given both halves of what happened:

```json
{ "input": <what the tracks were run on>, "results": [ <answer>, … ] }
```

Carrying on as though the tracks were side effects — the commonest case, and the
reason the reducer sees the input at all:

```json
{ "serviceId": "map", "state": { "mode": "replace", "template": { "=": "params.input" } } }
```

The first answer anything had: `{"=": "find(params.results, 'item !== null')"}`.
Everything together under names the board chose: a template naming
`params.results[0]`, `params.results[1]`. Something stranger: more services in
the reduce pipeline, which is a pipeline like any other.

With no reducer configured the array travels on as it is. **A reducer returning
`null` stops the pipeline**, as any service does.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `tracks` | `Track[]` | `[]` | The pipelines, in the order their answers appear |
| `reduce` | `PipelineEntry[]` | `[]` | Pipeline given `{ input, results }`; empty emits the array |
| `run` | `"serial" \| "parallel"` | `"serial"` | One at a time, or together |
| `bypass` | `boolean` | `false` | Passes the input straight through |

A track is `{ "name": string, "bypass"?: boolean, "pipeline": PipelineEntry[] }`.
The name is what a log, a panel and a reducer call it; a track without one is
called by the position it was declared in. `reduce` is reserved — a track may
not take it, since that is the name a pipeline edit uses to reach the reducer.
A bypassed track leaves a hole, like one that stopped.

---

## Example

Two writes about the same thing, and the thing itself carrying on:

```json
{
  "uuid": "record-svc",
  "serviceId": "tracks",
  "serviceName": "Keep or drop",
  "state": {
    "run": "serial",
    "tracks": [
      { "name": "keep", "pipeline": [
        { "instanceId": "insert", "serviceId": "sql", "serviceName": "Save an article",
          "state": { "mode": "run", "statement": "INSERT INTO article (link) SELECT $link WHERE $intent = 'keep'" } }
      ] },
      { "name": "drop", "pipeline": [
        { "instanceId": "delete", "serviceId": "sql", "serviceName": "Remove an article",
          "state": { "mode": "run", "statement": "DELETE FROM article WHERE $intent = 'drop' AND link = $link" } }
      ] }
    ],
    "reduce": [
      { "instanceId": "carry", "serviceId": "map", "serviceName": "What came in",
        "state": { "mode": "replace", "template": { "=": "params.input" } } }
    ]
  }
}
```

Note what each half is for. The **guards stay in SQL**, because a condition about
the data belongs in the language that addresses the data, and one guarded
statement beats a filter and a statement. What the board gains is everything
around them: that the two writes are independent, that they run in a known
order, and that what leaves is the article rather than a count of changed rows.

Demo board: `tracks-demo-board.json`.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value; every track is given it unchanged |
| **Output** | The answers as an array, or whatever the reducer made of them |

---

## Replaces Stack

The browser's `Stack` service was the first go at this idea: it fanned an input
out to a list of sub-services and collected an array. It is gone, and boards
carrying it have been rewritten. Three things changed.

Its `output` setting was declared and never read, so there was no reduce at all.
Its execution mode was welded to its input mode — `multiplex` ran serially,
`lanes` ran everything at once — so neither could be chosen. And it existed only
in the browser, so a board could not move.

`lanes` is gone with it: it dealt element *i* of an incoming array to
sub-service *i*, which reads as magic at the call site and is one `map` term at
the start of a track — `{"=": "params[0]"}` — where it can be seen.
