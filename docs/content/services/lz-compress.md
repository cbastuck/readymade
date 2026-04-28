# LZ Compress

Compresses or decompresses values using LZ-string — a URL-safe lossless text compression algorithm.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/lz-compress` |

---

## What it does

LZ Compress uses the [lz-string](https://github.com/pieroxy/lz-string) library to apply `compressToEncodedURIComponent` / `decompressFromEncodedURIComponent` to pipeline values.

In **compress** mode, non-string inputs are JSON-serialised first. The result is a URL-safe compressed string that can be embedded in a query parameter.

In **decompress** mode, the compressed string is decompressed; if the result is valid JSON it is parsed before emitting, so downstream services receive the original structured value.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `mode` | `"compress"` \| `"decompress"` | `"compress"` | Operating mode |

---

## Input / Output

| | Shape |
|---|---|
| **Input (compress)** | Any value — strings are compressed as-is; others are JSON-stringified first |
| **Output (compress)** | URL-safe compressed string |
| **Input (decompress)** | URL-safe compressed string |
| **Output (decompress)** | Original value — parsed as JSON if valid; otherwise the raw decompressed string |

Returns `null` (with no error) if decompression produces an empty string.

---

## Typical use: embed a board in a QR code URL

```
Browser Sub-Service (source mode) → LZ Compress → QR Code
```

The sub-service emits the board descriptor JSON, LZ Compress reduces it to a URL-safe string, and QR Code encodes it as a scannable link.
