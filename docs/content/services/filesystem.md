# Filesystem

Reads from and writes to the local file system on an hkp-rt server.

---

## Available in

| Runtime | Service ID |
|---|---|
| hkp-rt | `filesystem` |

Not available in the browser runtime. Requires an hkp-rt instance with
file system access (remote or realtime runtime).

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
