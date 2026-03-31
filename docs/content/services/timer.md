# Timer

Generates periodic or one-shot timing events to drive pipeline execution.

---

## Overview

The Timer service produces trigger events on a time-based schedule. It supports two operating modes: **periodic** (repeating interval) and **one-shot** (fires once after a delay). Each trigger increments an internal counter and emits the current count downstream.

**Available in:**
- Browser Runtime — service ID `hookup.to/service/timer`
- hkp-rt — service ID `timer`

---

## Operating Modes

| Mode | How it works | Relevant properties |
|---|---|---|
| **Periodic** | Fires repeatedly on a fixed interval using `setInterval` | `periodic: true`, `periodicValue`, `periodicUnit` |
| **One-shot** | Fires once after a delay using `setTimeout` | `periodic: false` (default), `oneShotDelay`, `oneShotDelayUnit` |

Setting `immediate: true` in either mode causes the first tick to fire almost instantly (1 ms) before the regular schedule begins.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `periodic` | `boolean` | `false` | When `true`, the timer fires repeatedly at the configured interval. When `false`, fires once. |
| `periodicValue` | `number` | `1` | Numeric amount for the repeating interval. Interpreted in `periodicUnit`. |
| `periodicUnit` | `string` | `"s"` | Time unit for `periodicValue`. Accepts any [moment.js duration unit](https://momentjs.com/docs/#/durations/): `"ms"`, `"s"`, `"m"`, `"h"`, `"d"`, etc. |
| `oneShotDelay` | `number` | `0` | Delay before a one-shot timer fires. |
| `oneShotDelayUnit` | `string` | `"ms"` | Time unit for `oneShotDelay`. Accepts `"ms"` or `"s"`. |
| `immediate` | `boolean` | — | When `true`, fires one tick immediately (after ~1 ms) in addition to the normal schedule. |
| `counter` | `number` | — | Overrides the internal trigger counter to a specific value. |
| `running` | `boolean` | — | Setting to `false` stops the timer. Setting to `true` starts it if `start` is not otherwise specified. |
| `until.triggerCount` | `number` | — | Automatically stops the timer after this many triggers have fired. |

### Commands

Commands are special keys that trigger immediate actions when passed to `configure`:

| Command | Description |
|---|---|
| `start` | Starts the timer. Equivalent to sending `{ start: true }`. |
| `stop` | Stops the timer and resets the counter to 0. |
| `restart` | Stops the timer then immediately starts it again (equivalent to `stop` + `start`). |

Changing `periodicValue` or `periodicUnit` while the timer is running silently restarts it with the new interval.

---

## Output Data

Each tick emits a single object downstream:

```json
{ "triggerCount": 1 }
```

`triggerCount` starts at 1 and increments by 1 on every tick.

---

## Example: 1-second Periodic Timer

The following Board Blueprint snippet configures a timer to fire once per second, starting immediately:

```json
{
  "serviceId": "hookup.to/service/timer",
  "config": {
    "periodic": true,
    "periodicValue": 1,
    "periodicUnit": "s",
    "immediate": true,
    "start": true
  }
}
```

---

## hkp-rt Differences

The hkp-rt `timer` service uses a single `delay` property expressed in **microseconds** instead of the `periodicValue`/`periodicUnit` pair used by the browser runtime.

| Browser Runtime | hkp-rt equivalent |
|---|---|
| `periodicValue: 1, periodicUnit: "s"` | `delay: 1000000` (1 second in µs) |
| `periodicValue: 500, periodicUnit: "ms"` | `delay: 500000` |

All other behaviour (counter, trigger output shape, `until.triggerCount`) is equivalent. Consult the hkp-rt source for the complete list of supported properties.
