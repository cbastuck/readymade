# Microphone Monitor

Measures the current microphone input level at a configurable interval and emits the result into the pipeline.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/microphone-monitor` |

---

## What it does

Microphone Monitor requests access to the user's microphone via `navigator.mediaDevices.getUserMedia`, connects the stream to a Web Audio `AnalyserNode`, and samples the RMS amplitude at a configurable interval. Each sample is emitted downstream as `{ level, levelDb }`.

The service is independent of the pipeline trigger — it fires on its own timer, not in response to upstream values.

---

## Prerequisites

- Must run on HTTPS or `localhost` (requires a secure context).
- The browser will prompt the user for microphone permission the first time the service starts.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `interval` | `number` | `500` | Sampling interval in milliseconds |
| `running` | `boolean` | `false` | `true` to start capturing; `false` to stop |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Ignored — Microphone Monitor emits independently on its own timer |
| **Output** | `{ level: number, levelDb: number }` — linear amplitude (0–1) and dB value |

---

## Status values

The UI panel shows a `status` string that transitions through:

| Status | Meaning |
|---|---|
| `"requesting mic..."` | Waiting for permission |
| `"active"` | Capturing and emitting |
| `"error: <message>"` | Permission denied or capture failed |

---

## Typical pipeline

```
Microphone Monitor → Map → Canvas
```

Map the `levelDb` value to a bar height and draw it on a Canvas to build a simple VU meter.
