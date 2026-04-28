# Hash

Computes a cryptographic hash of any pipeline value using the Web Crypto API.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/hash` |

---

## What it does

Hash stringifies the incoming value (or uses it directly if it is a `Uint8Array`/`ArrayBuffer`) and computes its hash using the SubtleCrypto API. The result is returned as a hex or base64 string.

A **progressive mode** (`sha-256p`) allows incremental hashing: successive inputs are buffered as chunks, and the final hash over all accumulated data is produced when `configure({ finalize: true })` is called.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `method` | `string` | `"sha-256"` | Hash algorithm. One of `"sha-256"`, `"sha-384"`, `"sha-512"`, `"sha-1"`, `"sha-256p"` |
| `encoding` | `"hex"` \| `"base64"` | `"hex"` | Output encoding for the hash digest |
| `finalize` | `boolean` | — | **Progressive mode only** — when `true`, computes and emits the hash over all buffered chunks via `app.next()` |

### Progressive mode (`sha-256p`)

1. Set `method: "sha-256p"`.
2. Send successive values through `process()` — each is buffered.
3. Call `configure({ finalize: true })` to compute the SHA-256 over all buffered data and emit the result.

Changing `method` while in progressive mode clears the chunk buffer.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value — stringified with `JSON.stringify` before hashing; `Uint8Array`/`ArrayBuffer` are hashed directly |
| **Output** | Hex or base64 string of the hash digest |

In `sha-256p` mode, `process()` returns `null` and the final hash is emitted asynchronously after `finalize`.

---

## Example: SHA-256 of a string

```json
{ "method": "sha-256", "encoding": "hex" }
```

Input: `"hello world"`
Output: `"b94d27b9934d3e08a52e52d7da7dabfac484efe04294e576f0f7f28e4b2b5a2f"` (truncated for illustration)
