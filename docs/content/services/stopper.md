# Stopper

Unconditionally stops the pipeline by returning `null` on every tick.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/stopper` |

---

## What it does

Stopper always returns `null`, which causes the pipeline to halt at that point. No value is forwarded to any downstream service.

Use Stopper as a dead end when you want to terminate a branch unconditionally — for example, at the end of a side-effect chain where no further processing should occur, or as a placeholder while building a pipeline.

---

## Configuration

None. Stopper accepts but ignores all configuration.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any (ignored) |
| **Output** | Always `null` |
