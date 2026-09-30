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

## Configuration

None. File Source has no configuration properties — content is emitted when the user picks files through the UI.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | None (triggered by the file picker) |
| **Output** | `string` — text content of a single file; `string[]` — text contents when multiple files are selected |

---

## Notes

Files are read as plain text (`FileReader.readAsText`). For binary files (images, audio), use [Image Picker](./image-picker.md) or [Chunked File Provider](./chunked-file-provider.md) instead.
