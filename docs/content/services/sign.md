# Sign

Computes an HMAC signature of any pipeline value using the Web Crypto API.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/sign` |

---

## What it does

Sign stringifies the incoming value (or uses raw bytes for typed arrays), computes an HMAC over the data using the configured secret, and emits the digest as a hex or base64 string.

A **progressive mode** (`HmacSHA256p`) buffers successive inputs and produces the HMAC over all accumulated data when `configure({ finalize: true })` is called.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `method` | `string` | `"HmacSHA256"` | HMAC algorithm. One of `"HmacSHA256"`, `"HmacSHA512"`, `"HmacSHA1"`, `"HmacSHA256p"` |
| `encoding` | `"hex"` \| `"base64"` | `"hex"` | Output encoding for the signature |
| `secret` | `string` | `"secret key 123"` | Shared secret used as the HMAC key |
| `finalize` | `boolean` | — | **Progressive mode only** — computes and emits the HMAC over all buffered chunks |

### Progressive mode (`HmacSHA256p`)

1. Set `method: "HmacSHA256p"` and configure `secret`.
2. Send successive values through `process()` — each chunk is buffered.
3. Call `configure({ finalize: true })` to compute the HMAC over all chunks and emit the result via `app.next()`.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value — stringified with `JSON.stringify`; `Uint8Array`/`ArrayBuffer` used directly |
| **Output** | Hex or base64 HMAC string |

In `HmacSHA256p` mode, `process()` returns `null` and the final signature is emitted asynchronously after `finalize`.

---

## Pairing with Hash

Use **Sign** when you need authenticity (HMAC requires a shared secret). Use **Hash** when you only need integrity (no secret).
