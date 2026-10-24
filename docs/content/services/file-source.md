# File Source

Lets the user select one or more local files and emits their contents into the pipeline.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/file-source` |

---

## What it does

File Source presents a file input in its UI panel. When the user selects files, the service reads each one as text and emits the results downstream via `app.next()`. If a single file is selected, its text content is emitted directly. If multiple files are selected, an array of text strings is emitted.

A facade's `file-pick` widget can hand it a file too: name the File Source as the widget's `action.serviceUuid`, and as its `progressServiceUuid` so the widget knows when the file has gone on. The file is read as text and emitted the same way — e.g. a picked `.sql` dump passed on to an hkp-node [SQL](./sql.md) service in `import` mode, as the [SQL Import](../boards/sql-import-board.md) board does.

---

### In chunks

With a `chunkSize`, each file is still read whole, but goes on as an **array of
pieces** of at most that many characters, in order — an array even when the file
fits in one piece, so what follows does not change shape with the size of the
file. Several files picked at once go on as an array of such arrays.

The pieces are still one value. What sends them on one by one is a
[Spread](./spread.md) after the File Source; a [Gather](./gather.md) on the far
side puts them back together. That is how a file larger than a deployed board's
frame limit (`HKP_COORDINATOR_MAX_FRAME_BYTES`) still reaches hkp-node:

```
ui:   file-source (chunkSize: 500000) → spread
node: gather (join(params.items, '')) → …
```

`chunkSize` counts characters, not bytes. For ASCII text — base64, CSV, most SQL
dumps — the two are the same; other text takes up to three bytes per character
in UTF-8, and a frame also carries the part's wrapping and any JSON escaping, so
leave room below the limit. A piece never ends between the two halves of a
surrogate pair.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `chunkSize` | `number` | `0` | Characters per piece; `0` sends each file whole |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | None (triggered by the file picker) |
| **Output** | `String` — text content of a single file; `JSON` — `string[]`, the text contents when multiple files are selected; with a `chunkSize`, `string[]` of pieces per file |

---

## Notes

Files are read as plain text (`FileReader.readAsText`). For binary files (images, audio), use [Image Picker](./image-picker.md) or [Chunked File Provider](./chunked-file-provider.md) instead.
