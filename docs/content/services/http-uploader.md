# HTTP Uploader

POSTs file chunks from a [Chunked File Provider](./chunked-file-provider.md) to a server endpoint.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/http-uploader` |

---

## What it does

HTTP Uploader consumes `ChunkPayload` objects emitted by [Chunked File Provider](./chunked-file-provider.md) and uploads each chunk to the configured `url` as a raw HTTP POST. Metadata about the chunk is sent as request headers so the server can reassemble the file.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | `""` | Server endpoint that receives each chunk |

---

## Request format

Each chunk is posted with the raw `ArrayBuffer` as the body and the following headers:

| Header | Value |
|---|---|
| `Content-Disposition` | `attachment; filename="<filename>"` |
| `Content-Type` | MIME type of the original file |
| `X-Upload-Id` | UUID shared across all chunks of the same upload |
| `X-Chunk-Index` | 0-based index of this chunk |
| `X-Total-Chunks` | Total number of chunks for this file |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | `ChunkPayload` from Chunked File Provider |
| **Output** | The original `ChunkPayload` (pass-through) |

---

## Status reporting

The UI panel shows the current upload progress (e.g. "Uploading chunk 2 / 5"). On success the status is cleared; on error the HTTP status or error message is displayed.

---

## Typical pipeline

```
Chunked File Provider → HTTP Uploader
```
