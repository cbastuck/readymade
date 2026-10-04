# Download

Saves whatever reaches it as a file, through the browser's own download, and passes it on.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/download` |

---

## What it does

Download turns its input into a file and hands it to the browser to save, the
way a link to a file would:

| Input | Saved as | Type, unless `mimeType` says otherwise |
|---|---|---|
| text | the text itself | `text/plain;charset=utf-8` |
| bytes (`Uint8Array`, `ArrayBuffer`) | the bytes | `application/octet-stream` |
| anything else | its JSON, indented | `application/json` |

The input then travels on **unchanged**, so a Download can sit in the middle of
a pipeline — saving a copy of what passes — as well as at its end. Nothing
arriving (`null`, `undefined`) saves nothing.

Each save is reported as `{ saved, bytes }`, and a failure as `{ error }`.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `filename` | `string` | `"download.txt"` | What the file is offered as |
| `mimeType` | `string` | `""` | The file's type; empty decides it from the input, as above |

A board that saves different things configures `filename` before each one — a
facade `repeat` can write it from the item, e.g. `"{{item.name}}.sql"`.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | text, bytes, or any JSON value |
| **Output** | the input, unchanged |

---

## Typical uses

- [SQL](./sql.md) (`export`) → Download: a browser database as an `.sql` file,
  as the [SQL Explorer](../boards/sql-explorer-board.md) does.
- Map → Download: whatever a pipeline has gathered, as JSON.

---

## Notes

The download is the browser's: where the file lands, and whether it asks
first, is the browser's setting. Inside the Readymade apps a webview may not
act on a browser download at all.
