# QR Code

Displays a QR code for a URL, updating dynamically when new URLs arrive in the pipeline.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/qr-code` |

---

## What it does

QR Code renders a scannable QR code image for the configured or pipeline-provided URL. The URL is resolved through `resolveTemplateVars` so template variables (e.g. `{{userId}}`) are substituted before encoding.

When the incoming value contains a `fromLink=` query parameter, QR Code appends the current template variable map as a base64-encoded `vars=` parameter so that the QR code carries the full context needed to reconstruct the state on the target device.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | `""` | Base URL to display as a QR code. Template variables are resolved. |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | String URL, or object with a `url` / `requestPath` key |
| **Output** | The original input value (pass-through) |

When the incoming URL differs from the current state, the displayed QR code updates automatically.

---

## Typical use: board-in-a-QR-code

```
Browser Sub-Service (source mode) → LZ Compress → QR Code
```

Sub-service emits the board JSON, LZ Compress reduces it to a URL-safe string, and QR Code renders a link that another device can scan to load the board.
