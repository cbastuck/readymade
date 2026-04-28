# Decrypt

Decrypts a base64-encoded AES-256-GCM ciphertext produced by the Encrypt service.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/decrypt` |

---

## What it does

Decrypt reverses the transformation applied by [Encrypt](./encrypt.md). It expects a base64 string whose raw bytes are `[12-byte IV][AES-256-GCM ciphertext]`, decrypts the ciphertext using the shared secret, and deserialises the plaintext back to the original JavaScript value.

If the original value was a `Blob` or `File`, the encrypted form contained a base64-encoded wrapper; Decrypt reconstructs the `Blob` from it.

### Key derivation

The secret string is hashed with SHA-256 to produce a 256-bit AES-GCM key. The same secret must be set in both Encrypt and Decrypt.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `secret` | `string` | `""` | Shared secret used to derive the decryption key |
| `method` | `"aes"` | `"aes"` | Encryption method (only AES-GCM is currently supported) |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Base64 string — `[12-byte IV][AES-256-GCM ciphertext]` |
| **Output** | Original value (object, string, number, or `Blob`) |

Returns `null` and emits an error notification if `secret` is not set or if the input is not a base64 string.

---

## Pairing with Encrypt

```
... → Encrypt → [transport / storage] → Decrypt → ...
```

Both services must be configured with the same `secret`. The encrypted payload is self-contained — the IV is embedded in the ciphertext string and a fresh IV is generated per encryption call.
