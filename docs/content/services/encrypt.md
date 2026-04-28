# Encrypt

Encrypts any pipeline value using AES-256-GCM and emits a self-contained base64 ciphertext string.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/encrypt` |

---

## What it does

Encrypt serialises the incoming value to JSON (or, for `Blob`/`File` inputs, encodes it to base64 first), encrypts the result with AES-256-GCM, prepends a freshly generated 12-byte random IV, and base64-encodes the whole payload.

The output is a portable string that can be stored, transmitted, or embedded in a URL. Use [Decrypt](./decrypt.md) with the same secret to recover the original value.

### Key derivation

The secret is hashed with SHA-256 to produce a 256-bit AES-GCM key. A new random IV is generated on every `process()` call so identical inputs produce different ciphertexts.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `secret` | `string` | `""` | Shared secret used to derive the encryption key |
| `method` | `"aes"` | `"aes"` | Encryption method (only AES-GCM is currently supported) |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any JSON-serialisable value, or a `Blob`/`File` |
| **Output** | Base64 string — `[12-byte IV][AES-256-GCM ciphertext]` |

Returns `null` and emits an error notification if `secret` is not set.

---

## Example pipeline: encrypt sensor data before storage

```
Timer → Map → Encrypt → LocalStorage
```

Map shapes the timer tick into `{ temperature: 21.5 }`, Encrypt produces a base64 string, LocalStorage persists it. The stored value is opaque until decrypted with the same secret.
