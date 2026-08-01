# Stopper

Unconditionally stops the pipeline by returning `null` on every tick.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/stopper` |
| hkp-node | `stopper` |

---

## What it does

Stopper always returns `null`, which causes the pipeline to halt at that point. No value is forwarded to any downstream service.

Use Stopper as a dead end when you want to terminate a branch unconditionally — for example, at the end of a side-effect chain where no further processing should occur, or as a placeholder while building a pipeline.

On a board with several runtimes it does one more thing. Runtimes are chained — the
result of one becomes the input of the next — so a runtime whose work is a side effect
rather than a value should end in a Stopper, instead of feeding whatever it happened to
produce into the next runtime. Without it, a runtime that serves an endpoint placed ahead
of the runtime that calls that endpoint will drive the caller with its own answer, and the
two will call each other in a loop.

Behind an [`http-server-subservices`](./http.md) with a nested pipeline configured, a
Stopper does exactly that and nothing more: the nested pipeline has already answered the
HTTP caller, so ending the chain does not affect the response. Without a nested pipeline
the rest of the board *is* the response, and a Stopper there answers the caller with
`null` — which is either what you meant or a sign the handler belongs in a nested
pipeline.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `bypass` | `boolean` | `false` | Pass input through instead of stopping (hkp-node) |

The browser implementation accepts but ignores all configuration.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any (ignored) |
| **Output** | Always `null` |
