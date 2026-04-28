# Analyzer

Forwards pipeline data unchanged while notifying the UI of each value as it passes through.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/analyzer` |

---

## What it does

Analyzer is a transparent inspection service. It passes every incoming value through to the next service unmodified, and simultaneously emits a notification to its UI panel via `app.notify`. The UI can observe and visualise the raw data without affecting the pipeline.

Use Analyzer when you need a programmable observation point that is distinct from Monitor — for example, when you want custom visualisation logic wired into the service's UI rather than a generic JSON log.

---

## Configuration

None. Analyzer has no configuration properties.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value |
| **Output** | Identical to input — passes through unchanged |

---

## Differences from Monitor

| | Analyzer | Monitor |
|---|---|---|
| UI | Custom / programmable | Generic scrolling JSON log |
| Pass-through | Yes | Yes |
| Notification payload | `{ onProcess: <value> }` | Rendered in the log directly |
