# Encode

Encodes or decodes values using Base64 or URL encoding.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/encode` |

---

## What it does

Encode applies a reversible text transformation to pipeline values. The operating **mode** selects the algorithm:

| Mode | Description |
|---|---|
| `base64-encode` | UTF-8-safe Base64 encoding. Non-string inputs are JSON-stringified first. |
| `base64-decode` | Decodes a Base64 string; the result is parsed as JSON if valid, otherwise returned as a plain string. |
| `url-encode` | Applies `encodeURIComponent`. Non-string inputs are JSON-stringified first. |
| `url-decode` | Applies `decodeURIComponent`. The result is parsed as JSON if valid. |
| `hex-encode` | Encodes to lowercase hex. Non-string inputs are JSON-stringified first. |
| `hex-decode` | Decodes a hex string back to UTF-8. The result is parsed as JSON if valid. Whitespace is ignored. |

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `mode` | `"base64-encode"` \| `"base64-decode"` \| `"url-encode"` \| `"url-decode"` \| `"hex-encode"` \| `"hex-decode"` | `"base64-encode"` | Operating mode |

---

## Input / Output

| | Shape |
|---|---|
| **Input (encode modes)** | Any value — strings are encoded as-is; other values are JSON-stringified first |
| **Output (encode modes)** | Encoded string |
| **Input (decode modes)** | Encoded string |
| **Output (decode modes)** | Decoded value — parsed as JSON if valid; otherwise the raw decoded string |

Returns `null` (with an error notification) if a decode operation receives invalid input.

---

## Typical uses

**Embed structured data in a URL query parameter:**

```
Map → Encode (url-encode) → QR Code
```

**Round-trip an object through a text channel:**

```
Injector → Encode (base64-encode) → ... → Encode (base64-decode) → Monitor
```
