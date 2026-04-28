# Chunked File Provider

Splits a file selected by the user into fixed-size chunks and emits each chunk sequentially as a `ChunkPayload`.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/chunked-file-provider` |

---

## What it does

Chunked File Provider presents a file picker in its UI panel. When the user selects a file and clicks **Process**, the service reads the file as an `ArrayBuffer`, divides it into chunks of up to `chunkSize` bytes, and emits one `ChunkPayload` object per chunk via `app.next()`.

This is the source service for large file uploads. Pair it with [HTTP Uploader](./http-uploader.md) to stream a file to a server endpoint that can reassemble the chunks.

---

## Default chunk size

3 MB (3 × 1024 × 1024 bytes) — chosen to stay under typical 4 MB API gateway payload limits.

---

## Output shape

Each emitted value is a `ChunkPayload`:

```typescript
{
  data: ArrayBuffer;      // raw bytes of this chunk
  filename: string;       // original filename with a timestamp suffix appended
  mimeType: string;       // MIME type of the file
  chunkIndex: number;     // 0-based index of this chunk
  totalChunks: number;    // total number of chunks for this file
  uploadId: string;       // UUID shared across all chunks of the same file send
}
```

The `uploadId` is a unique UUID generated per file send so the server can group chunks belonging to the same upload.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Triggered by the UI — no pipeline input consumed |
| **Output** | `ChunkPayload` — one emission per chunk |

---

## Typical pipeline

```
Chunked File Provider → HTTP Uploader
```

Chunked File Provider slices the file; HTTP Uploader POSTs each chunk to a server endpoint that reassembles them.
