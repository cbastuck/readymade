# Delay

Applies a digital delay effect to an audio pipeline, adding an echo to the signal.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/delay` |

---

## What it does

Delay is an audio effect service. It receives `FloatRingBuffer` frames from an upstream audio service, applies a delay-line algorithm (with feedback and wet/dry mix), and emits the processed audio downstream. Non-audio values are passed through unchanged.

The delay algorithm uses a fixed circular buffer of up to 2000 ms. Each sample is read from a position offset by the delay time, blended with a configurable feedback level, and mixed with the dry signal.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `time` | `number` | `0.5` | Delay time in seconds |

Additional internal parameters (not yet exposed via configure):

| Parameter | Default | Description |
|---|---|---|
| `feedback` | `0.5` | How much of the delayed signal is fed back into the delay line (0–0.999) |
| `mix` | `0.5` | Wet/dry blend (0 = dry only, 1 = wet only) |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | `FloatRingBuffer` — audio sample frames |
| **Output** | `FloatRingBuffer` — delay-processed audio |

Non-`FloatRingBuffer` inputs are returned unchanged.

---

## Typical use

```
AudioInput → Delay → AudioOutput
```

Place Delay between an audio source and the audio output to add a reverb-like echo effect. Adjust `time` to control the echo offset.
