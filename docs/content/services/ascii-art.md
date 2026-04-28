# ASCII Art

Converts an image (Blob) into a text grid of ASCII characters representing its luminance.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/ascii-art` |

---

## What it does

ASCII Art receives an image `Blob` from the pipeline, draws it onto an off-screen canvas scaled to the configured grid dimensions, samples the luminance of each pixel, and maps each luminance value to a character from the configured character set. The resulting string grid is emitted downstream.

A typical use is to pipe Camera output through ASCII Art to produce a live ASCII-art webcam feed.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `cols` | `number` | `100` | Number of character columns in the output grid |
| `rows` | `number` | `60` | Number of character rows in the output grid |
| `charset` | `string` | `" .:-=+*#%@"` | Ordered character ramp from lightest to darkest |
| `invert` | `boolean` | `false` | When `true`, reverses the luminance mapping (dark → light characters) |
| `imageKey` | `string` | `"image"` | Key on the incoming object that holds the `Blob` |

### Character set

Characters are indexed by normalised luminance: the first character in the string is used for the lightest pixels, the last for the darkest. Any string of two or more characters works; a ten-character ramp (`" .:-=+*#%@"`) is a good starting point.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Object with a `Blob` at the key specified by `imageKey`, e.g. `{ image: <Blob> }` |
| **Output** | String — each row of characters joined by newlines |

If the input does not contain a `Blob` at `imageKey`, the original value is passed through unchanged.

---

## Example pipeline

```
Camera → ASCII Art → Monitor
```

Configure Camera to emit `{ image: <Blob> }`, then ASCII Art converts it to a string and Monitor displays it.
