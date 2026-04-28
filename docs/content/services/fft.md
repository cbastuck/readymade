# FFT

Converts a raw audio sample buffer into a frequency spectrum, or reconstructs samples from a spectrum (IFFT).

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/fft` |
| hkp-rt | `fft` |
| hkp-rt | `ifft` |

The browser and hkp-rt FFT services have different configuration properties and input types. IFFT is hkp-rt only — see [IFFT](./ifft.md).

---

## Browser FFT

**Service ID:** `hookup.to/service/fft`

### What it does

Receives a `FloatRingBuffer` from upstream audio services, applies windowing, performs a Cooley–Tukey FFT, and emits a frequency spectrum array. The spectrum format is controlled by `outputFormat`.

### Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `windowFunction` | `string` | `"none"` | Window function applied before the FFT. One of `"none"`, `"hann"`, `"hamming"`, `"blackman"`, `"rectangular"` |
| `outputFormat` | `string` | `"magnitude"` | Output spectrum format. One of `"magnitude"`, `"power"`, `"db"` |
| `fftSize` | `number \| "auto"` | `null` (auto) | Number of samples per FFT window. Must be a power of 2. `"auto"` uses the ring buffer size. |

### Input / Output

| | Shape |
|---|---|
| **Input** | `FloatRingBuffer` from an audio source (e.g. Audio Input) |
| **Output** | Array of `fftSize / 2` values in the format specified by `outputFormat` |

### Typical pipeline

```
Audio Input → FFT → Monitor
Audio Input → FFT → Canvas (array draw element)
```

---

## hkp-rt FFT

**Service ID:** `fft`

### What it does

Receives an audio ring-buffer (a stream of float samples), reads the most recent `windowLength` samples, applies a Fast Fourier Transform, and emits an array of values — one per frequency bin from 0 Hz up to the Nyquist frequency.

### Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `windowLength` | `number` | `512` | Number of samples per FFT window. Must be a power of 2. |
| `outputMode` | `string` | `"magnitude"` | Output format: `"magnitude"` (real array), `"complex"` (array of `{re, im}` objects) |

### Input

A **ring-buffer** data value produced by `core-input`. The ring-buffer must contain at least `windowLength` samples; if fewer are available the service returns `null`.

### Output

- `"magnitude"` mode: JSON array of `windowLength / 2` magnitude floats. Index 0 is DC, last element is Nyquist.
- `"complex"` mode: JSON array of `windowLength` objects `{ re, im }` — preserves phase for lossless IFFT reconstruction.

---

## Notes

- FFT window sizes must be powers of 2: `64`, `128`, `256`, `512`, `1024`, `2048`, `4096`.
- For audio effect chains requiring IFFT reconstruction, use `outputMode: "complex"` in hkp-rt so phase information is preserved.

---

## Typical hkp-rt pipelines

### Real-time spectrum analyser

```
core-input → fft → monitor
```

### Audio effect chain

```
core-input → fft (outputMode: "complex") → map → ifft → core-output
```
