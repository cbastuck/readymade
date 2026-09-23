# Filesystem

Reads from and writes to the local file system on an hkp-rt server.

---

## Available in

| Runtime | Service ID |
|---|---|
| hkp-rt | `filesystem` |
| Node.js (hkp-node) | `filesystem` |

Not available in the browser runtime, which cannot reach the file system.

The two differ in what they can reach, and deliberately. On hkp-rt — a runtime
somebody runs on their own machine — a path is a path on that machine. On
hkp-node, which is multi-tenant, a board names a path **inside a volume** the
runtime owns, and nothing it can write resolves outside one: a server that
offered "the local filesystem" to every board on it would not be multi-tenant
for long. The rest of this page describes the hkp-rt service; the hkp-node one
is described below.

---

## What it does

Filesystem performs read and write operations on the server's local file
system. The operation is determined by the incoming pipeline data or by
configuration.

---

## Configuration

| Property | Type | Description |
|---|---|---|
| `path` | `string` | File or directory path on the server |
| `mode` | `"read" \| "write"` | Operation to perform |
| `encoding` | `string` | File encoding (e.g. `"utf8"`) for text files |

---

## Input / Output

### Read mode

| | Shape |
|---|---|
| **Input** | Any value (trigger only) |
| **Output** | File contents as a string (text) or byte array (binary) |

### Write mode

| | Shape |
|---|---|
| **Input** | String or byte array to write |
| **Output** | Write confirmation or `null` |

---

## Typical use

### Load a configuration file at startup

```
timer (one-shot) → filesystem (read, path: "/config/settings.json") → map → configure services
```

### Append log entries to a file

```
data source → map (format log line) → filesystem (write, path: "/logs/output.log")
```

### Process a dataset file

```
filesystem (read) → map (parse CSV/JSON) → buffer → process
```


---

## On hkp-node

The node service answers the same requests [Storage](./storage.md) does, because
it is what a Storage is usually pointing at:

```json
{ "op": "write", "path": "episodes/one.mp3", "binary": "…the bytes…" }
```

`read`, `write`, `list`, `stat` and `delete`, with the operation coming from the
request rather than from a mode — one instance therefore answers a read and a
write, which is what lets it be swapped for another backend without the services
around it noticing.

### Configuration

| Property | Type | Description |
|---|---|---|
| `volume` | `string` | Which library this instance reads and writes. Empty is the board's own |
| `operation` | `string` | What a request naming none means |
| `path` | `string` | What a request naming none means |

### Where the files are

```
<root>/<sha256(owner)>/<volume>/<path>
```

The owner is hashed and the rest is not, and the asymmetry is the point. An
owner comes from a token and may contain anything, so it is derived into a path
rather than used as one. A volume and a path are written by a board, can
therefore be checked, and are worth keeping legible — the reason to put bytes on
a disk rather than in a record is that they can then be found, copied, played and
backed up by somebody who is not this runtime.

What is checked is narrow, because these names become a real path: a segment is
letters, digits, dot, dash and underscore, a leading dot is not a name, and
nothing resolves outside the volume it named. A board that gets it wrong is told.

`HKP_FILES_DIR` says where the root is; empty keeps everything in memory, the
way `HKP_STORE_DIR` and `HKP_DB_DIR` do.

### Sharing a volume

An unnamed volume belongs to the board, derived from its name. Two boards share
one by **naming the same volume** — a board that renders audio and a board that
publishes it, working over one library — exactly as two boards share tables by
naming the same [database](./sql.md).

### Answers

A read comes back as `meta` beside `binary`, which is also a response envelope:
put an endpoint in front of a Storage and a file is served as what it is, content
type and all. A miss is a `404` in `meta.status` rather than an exception, and a
`stat` for a file that is not there is a `200` saying `exists: false` — absence
is an answer to that question, not a failure.
