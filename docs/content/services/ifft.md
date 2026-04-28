# IFFT

Computes the Inverse Fast Fourier Transform (IFFT) to reconstruct a time-domain signal from frequency-domain data.

---

## Available in

| Runtime | Service ID |
|---|---|
| hkp-rt | `ifft` |

---

## What it does

IFFT is the inverse of the [FFT](./fft.md) service. It expects a JSON array of complex frequency-domain coefficients (the output of FFT) and reconstructs the corresponding time-domain signal by applying the Cooley–Tukey IFFT algorithm.

The output is a JSON array of real-valued samples. The window length is determined by the size of the input array.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `windowLength` | `number` | `512` | Expected window length in samples (informational; actual length is taken from the input array size) |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | JSON array of complex numbers `[re, im, re, im, ...]` or `[{ re, im }, ...]` |
| **Output** | JSON array of real-valued time-domain samples |

---

## Typical use

```
FFT → [frequency-domain processing] → IFFT → AudioOutput
```

Apply spectral processing (e.g. filtering, pitch shifting) between FFT and IFFT to modify an audio signal in the frequency domain.
