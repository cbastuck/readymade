# FFT

Converts a raw audio sample buffer into a frequency-magnitude spectrum (FFT), or reconstructs samples from a spectrum (IFFT).

---

## Available in

| Runtime | Service ID |
|---|---|
| hkp-rt | `fft` |
| hkp-rt | `ifft` |

These services are not available in the browser runtime. Use a remote or
realtime runtime backed by hkp-rt.

---

## FFT — Forward Transform

### What it does

Receives an audio ring-buffer (a stream of float samples), reads the
most recent `windowLength` samples, applies a Fast Fourier Transform,
and emits an array of magnitude values — one per frequency bin from 0 Hz
up to half the sample rate (Nyquist frequency).

### Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `windowLength` | `number` | `512` | Number of samples per FFT window. Must be a power of 2. |

### Input

A **ring-buffer** data value produced by an audio capture service such
as `core-input`. The ring-buffer must contain at least `windowLength`
samples; if fewer samples are available the service returns `null` and
waits for more data.

The input sample count must be a power of 2. If it is not, the service
returns `null` and logs a warning.

### Output

A JSON array of `windowLength / 2` floating-point magnitude values,
indexed by frequency bin:

```json
[0.012, 0.034, 1.234, 0.567, ...]
```

Index 0 is the DC component (0 Hz); the last element corresponds to the
Nyquist frequency. Magnitude is the absolute value of the complex
spectrum coefficient.

---

## IFFT — Inverse Transform

### What it does

Takes a frequency-magnitude array (the output of FFT or a synthetically
generated spectrum) and reconstructs a time-domain sample array.

### Input

An array of complex or magnitude values in the frequency domain.

### Output

A sample array in the time domain, suitable for passing to `core-output`
for playback.

---

## Typical pipelines

### Real-time spectrum analyser

```
core-input → fft → monitor
```

### Audio effect chain

```
core-input → fft → map (filter/modify spectrum) → ifft → core-output
```

### Offline analysis from file

```
wav-reader → fft → monitor
```

---

## Notes

- FFT window size must be a power of 2 (`64`, `128`, `256`, `512`,
  `1024`, `2048`, `4096`).
- The output array length is always `windowLength / 2` (positive
  frequencies only).
- For audio processing, `core-input` must be on the same hkp-rt instance
  as the FFT service.
