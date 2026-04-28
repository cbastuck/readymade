# Batcher

Collects incoming pipeline values and flushes them as a batch after a minimum delay between flushes.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/shared/batcher` |

---

## What it does

Batcher accumulates values arriving via `process()` into an internal array. It schedules a flush using a timer that respects a minimum delay (`minDelayInMsec`) between consecutive flushes. If values arrive faster than the delay allows, they are held until the timer fires.

When the flush timer fires, the accumulated batch is emitted downstream via `app.next()` and the buffer is cleared.

Unlike [Buffer](./buffer.md), Batcher does not have a capacity limit — it is purely time-driven.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `minDelayInMsec` | `number` | `1000` | Minimum time in milliseconds between batch emissions |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value |
| **process() return** | Always `null` — emission happens asynchronously via `app.next()` |
| **Flush emission** | Array of all accumulated values since the last flush |

---

## Differences from Buffer

| | Batcher | Buffer |
|---|---|---|
| Flush trigger | Time only | Capacity or time |
| Capacity limit | None | Yes (`capacity`) |
| Service ID namespace | `hookup.to/shared/` | `hookup.to/service/` |
