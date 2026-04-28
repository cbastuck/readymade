# Image Picker

Presents a file picker for images and emits the selected image as a `Blob` into the pipeline.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/image-picker` |

---

## What it does

Image Picker provides a UI panel with a **Choose Image** button and a **Send** button. When the user picks an image file (JPEG, PNG, or any browser-supported format), a preview is displayed. Clicking **Send** emits the raw image `Blob` downstream.

On mobile devices, the `capture="environment"` attribute on the file input allows the camera to be used directly.

---

## Configuration

None. All interaction is through the UI panel.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | None (triggered by the UI) |
| **Output** | `Blob` — the raw image file |

---

## Typical pipelines

```
Image Picker → ASCII Art → Monitor
```

Pick an image; ASCII Art converts it to a character grid.

```
Image Picker → OpenAI Prompt → Monitor
```

Send an image to a vision model for analysis.
