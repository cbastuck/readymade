# Storage

A place on the board where a board keeps bytes — audio it rendered, a file
somebody uploaded, an export — addressed by path and backed by whatever the
board points it at.

---

## Available in

| Runtime | Service ID |
|---|---|
| Node.js (hkp-node) | `storage` |

---

## What it does

Storage is the board's name for a place things are kept. What actually holds
them is its **nested pipeline**: [Filesystem](./filesystem.md) today, something
speaking S3 or SQL the day a board needs that, with nothing in front of it
changing. That indirection is the whole service. Without it, one backend's
vocabulary spreads through every board that keeps anything.

It is deliberately not a record store. [Store](./store.md) keeps JSON a board
wrote and [SQL](./sql.md) keeps rows a board queries; what neither can hold is a
byte stream something outside the board will read.

## The contract is a request, not a set of paths

A request says what it wants done, to what, and with what:

```json
{ "op": "write", "path": "episodes/one.mp3", "binary": "…the bytes…" }
```

| `op` | Does | Answers with |
|---|---|---|
| `read` | reads one file | `meta` + `binary`, or a 404 |
| `write` | writes one file | what was written: path, size, modified |
| `list` | every file under a prefix | `files`, `count` |
| `stat` | asks whether a file is there | `exists`, and its size if it is |
| `delete` | removes one file | whether there was one to remove |

Bytes may arrive as `binary` (a `Uint8Array` from another service or an HTTP
body), as `base64` (for a caller with only JSON to send), or as `body` — a
string or an object, for the boards that write a feed or a manifest and would
otherwise need an encoder service in between.

The same request stands whether it arrived as a value in a pipeline, as JSON
over a mount, or as a plain HTTP call, which is what keeps this from being an
API somebody has to learn twice.

### An HTTP request is read as the same thing

| Request | Means |
|---|---|
| `GET /episodes/one.mp3` | `read` |
| `GET /episodes/` or `GET /` | `list` |
| `HEAD /episodes/one.mp3` | `stat` |
| `PUT` / `POST` | `write`, with the body as the bytes |
| `DELETE` | `delete` |

So a browser, a podcast client or `curl` reaches a store without being told
anything, and a read comes back as what it is — `audio/mpeg` for an mp3 — with
range requests answered so a player can seek. See
[the response envelope](./http.md#what-a-handler-may-answer-with).

**A listing is JSON, and stays JSON.** Opening the endpoint itself in a browser
shows the listing as data rather than as a page, because a store answers callers
rather than readers; what turns it into something to click is a panel, or a feed.
A single file opened in a browser does play — an `audio/mpeg` response is all a
browser needs.

A listing is also the raw material for a document some other program does
understand. A board that wants one publishes it beside the store rather than
asking the store to speak that language: `sql` over `json_each($rows)` joins the
listing into the document — an M3U playlist, a feed — a `map` gives it a content
type, and a second endpoint publishes it from a slot. The store keeps its
one job, and the board gains an address it can hand to a media player. The
library unit of the reading-radio boards does exactly this.

A caller with a storage request to make can also POST it as JSON to the same
endpoint; a body carrying an `op` is read as the request rather than as bytes
to keep.

## Configuration

| Property | Type | Description |
|---|---|---|
| `pipeline` | `array` | The backend. Required — a store with none says so rather than inventing one |
| `prefix` | `string` | Confines every path to one part of the store |
| `readOnly` | `boolean` | Answers reads and refuses everything else |
| `operation` | `string` | What a request naming no `op` means (default `read`) |

### `readOnly` is what makes a public endpoint safe

A [mount](../concepts/mounts.md) is unauthenticated by design, so the instance
behind one answers reads and nothing else. The instance a board writes through
is a different one, reachable only from inside. Two instances over one place,
with the policy in the board where it can be read, rather than a flag buried in
whatever happens to hold the bytes.

`prefix` is the other half of that: a board can hand out an endpoint over its
episodes without handing out one over everything else it kept.

It is **invisible from outside**. A caller asks for `one.mp3`, so a listing
answers `one.mp3` — not `episodes/one.mp3`, which asked for at that same endpoint
would resolve to `episodes/episodes/one.mp3`. A path a listing gives out has to
be one that can be asked for again.

## Two boards sharing one place

Storage keeps nothing itself, so what two boards share is whatever their
backends name — for Filesystem, a **volume**. Naming the same volume is how a
board that renders audio and a board that publishes it work over one library, the
same way two boards share tables by naming the same [database](./sql.md).

## Example

A public endpoint over a library, read-only:

```json
{
  "uuid": "listen",
  "serviceId": "http-server-subservices",
  "state": {
    "mountName": "listen",
    "pipeline": [
      {
        "instanceId": "episodes",
        "serviceId": "storage",
        "state": {
          "readOnly": true,
          "prefix": "episodes",
          "pipeline": [
            { "instanceId": "files", "serviceId": "filesystem", "state": { "volume": "radio" } }
          ]
        }
      }
    ]
  }
}
```

## Demo board

`storage-demo-board.json` — writes what you type into a volume and serves it
back at an address.

## See also

- [Filesystem](./filesystem.md) — the backend this uses by default
- [HTTP](./http.md) — the endpoint in front of it, and what it may answer with
- [Store](./store.md) — records rather than files
