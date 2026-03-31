# Monitor

Displays the current pipeline value in a scrolling log; passes data through unchanged.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/monitor` |
| hkp-rt | `monitor` |

---

## What it does

Monitor is a purely observational service — it shows what is currently
flowing through the pipeline without modifying it. Every value that
arrives is displayed in the service's UI panel and the original value is
passed to the next service unmodified.

Use Monitor anywhere in a pipeline to inspect intermediate values while
building or debugging a board.

---

## Configuration

### Browser

The browser Monitor has no required configuration. The UI panel shows
each incoming value as formatted JSON in a scrolling list.

### hkp-rt

| Property | Type | Default | Description |
|---|---|---|---|
| `logToConsole` | `boolean` | `true` | Print each value to the server's stdout |
| `fileLogPath` | `string` | `""` | Append each value to a file at this path |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value |
| **Output** | Identical to input — passes through unchanged |

Monitor never returns `null`; it always forwards whatever it receives.

---

## Typical use

Place a Monitor at any point in a pipeline to see what data is at that stage:

```
Timer → Map → Monitor → Canvas
                ↑
         inspect here
```

In production boards a Monitor with `bypass: true` can be left in place
as a zero-cost debug tap that can be re-enabled without editing the board
configuration.
