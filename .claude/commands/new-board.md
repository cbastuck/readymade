---
description: Design and generate a complete HKP board JSON from a description — runtimes, services, wiring, and optional facade
allowed-tools: Read, Write, Edit, Bash
---

# New Board

You are designing a complete HKP board from a description. A board is the top-level artifact
in HKP — it declares runtimes, wires services through them, and optionally defines a facade
that gives users a polished app-like interface on top.

Work through these steps in order. Ask focused questions only where the goal is genuinely
ambiguous.

---

## Step 1 — Understand the goal

Before designing anything, establish:
- What should the board *do* from the user's perspective?
- What data flows through it and in which direction?
- Does it need real-time/streaming data, or is it event-driven?
- Who is the audience — the builder themselves, or other (non-technical) users?

The last question determines whether a facade is needed.

---

## Step 2 — Choose runtimes

Pick the minimum set of runtimes that covers the domains involved:

| If you need… | Use runtime |
|---|---|
| UI, browser APIs, WebRTC, camera, audio Web API | Browser |
| Messaging (Telegram, SMTP, IMAP), HTTP server, file I/O | Node.js (hkp-node) |
| Audio DSP (FFT, IFFT, WAV, ring buffers), high-performance C++ | hkp-rt |
| AI/ML, Python-native open-source models | Python (hkp-python) |

Start with the fewest runtimes that work. A single browser runtime is almost always the
right starting point — only add remote runtimes for capabilities that don't exist in the
browser.

Runtimes chain left-to-right in the board JSON array. Data flows from runtime[0] → runtime[1]
→ … The browser runtime is almost always first (it drives the board) or last (it displays
results). Remote runtimes sit in the middle.

---

## Step 3 — Select services

Check `docs/content/services/` for the full service catalog — each `.md` file is a service,
and its first line after the `#` heading is a one-line description. Read the relevant docs
before picking services; don't guess at service IDs or state fields.

**Service ID conventions:**
- Browser services: `hookup.to/service/<slug>` (e.g. `hookup.to/service/timer`)
- Node.js services: plain slug (e.g. `monitor`, `peer-server`, `smtp`)
- hkp-rt services: plain slug (e.g. `wav-reader`, `websocket-writer`)

**Ordering within a runtime** = wiring. The first service receives input from the previous
runtime (or triggers itself, like Timer). Each service's output is the next service's input.
Return `null` from a service to stop propagation; return early to skip downstream services.

**Useful services for common patterns:**
- Source: `injector` (manual trigger), `timer` (periodic), `microphone-monitor`, `input`
- Transform: `map`, `filter`, `select`, `smooth`, `delay`, `cache`, `debounce`
- Control flow: `switch`, `if`, `filter`, `stopper`, `looper`
- Output: `monitor` (debug), `canvas`, `output`, `fetcher`, `smtp`, peer services
- Composition: `sub-service` (nested pipeline), `board-service` (embed another board)

---

## Step 4 — Generate the board JSON

Produce a valid board JSON file at `hkp-frontend/boards/<slug>-board.json`.

### Full schema

```json
{
  "boardName": "Human-readable name",
  "runtimes": [
    {
      "id": "unique-runtime-id",
      "name": "Display Name",
      "type": "browser",
      "state": {
        "wrapServices": false,
        "minimized": false
      }
    }
  ],
  "services": {
    "unique-runtime-id": [
      {
        "uuid": "descriptive-service-uuid-svc",
        "serviceId": "hookup.to/service/<slug>",
        "serviceName": "Display Name",
        "state": {}
      }
    ]
  }
}
```

### Remote runtime entry (Node, hkp-rt, Python)

```json
{
  "id": "node-runtime",
  "name": "Node",
  "type": "rest",
  "url": "http://127.0.0.1:8080",
  "state": { "wrapServices": false, "minimized": false }
}
```

Use `"HKP_RUNTIME_HOST"` as a template variable in URLs when the remote host address is
not known at design time (e.g. `"url": "http://HKP_RUNTIME_HOST:8080"`). The playground
resolves this at runtime.

### UUID naming convention

Use descriptive kebab-case with a `-svc` suffix. Make the name hint at the role, not the
service type: `threshold-filter-svc` not `filter-1-svc`.

### Common board patterns

**Single browser runtime** — everything in one process:
```json
{
  "boardName": "My App",
  "runtimes": [{ "id": "ui", "name": "Browser", "type": "browser", "state": { "wrapServices": false } }],
  "services": {
    "ui": [
      { "uuid": "source-svc", "serviceId": "hookup.to/service/injector", "serviceName": "Source", "state": {} },
      { "uuid": "transform-svc", "serviceId": "hookup.to/service/map", "serviceName": "Transform", "state": {} },
      { "uuid": "output-svc", "serviceId": "hookup.to/service/monitor", "serviceName": "Output" }
    ]
  }
}
```

**Browser → Node → Browser** — node processes in the middle:
```json
{
  "runtimes": [
    { "id": "ui-in",  "name": "Browser", "type": "browser", "state": { "wrapServices": false } },
    { "id": "node",   "name": "Node",    "type": "rest", "url": "http://127.0.0.1:8080", "state": { "wrapServices": false } },
    { "id": "ui-out", "name": "Result",  "type": "browser", "state": { "wrapServices": false } }
  ],
  "services": {
    "ui-in":  [ /* trigger or input services */ ],
    "node":   [ /* node services */ ],
    "ui-out": [ /* display services */ ]
  }
}
```

---

## Step 5 — Add a facade (when the board is for non-technical users)

A facade sits on top of the board and presents a polished, user-friendly interface with
named controls and displays. Add it as a `"facade"` key in the board JSON.

### Facade schema

```json
{
  "layout": "single",
  "panels": [
    {
      "id": "panel-id",
      "title": "Optional panel title",
      "layout": { ...LayoutItem }
    }
  ]
}
```

`layout` is `"single"` (one panel fills the view) or `"columns"` (panels side-by-side).

### LayoutItem — container or widget

A **container** groups children:
```json
{
  "direction": "row | column",
  "gap": 12,
  "padding": 16,
  "align": "center",
  "justify": "center",
  "fill": true,
  "wrap": false,
  "items": [ ...LayoutItem[] ]
}
```

A **widget leaf** has a `type` field. All widgets may also carry `"grow": true` to fill
remaining space in their parent container.

### Widget types

**button** — sends a configure payload to a service:
```json
{ "type": "button", "label": "Start", "action": { "serviceUuid": "timer-svc", "configure": { "start": true } } }
```

**text-input** — text field that configures a service on submit. `$$input` is replaced with the typed value:
```json
{ "type": "text-input", "label": "Topic", "placeholder": "my-topic", "submitLabel": "Set",
  "action": { "serviceUuid": "notifier-svc", "configure": { "url": "https://ntfy.sh/$$input" } } }
```

**knob** — rotary control with optional markers and live readout:
```json
{ "type": "knob", "label": "Threshold", "min": -60, "max": 0, "defaultValue": -12, "unit": "dB",
  "width": 130, "height": 110, "showValue": true,
  "markers": [ { "value": -20, "text": "loud" } ],
  "action": { "serviceUuid": "filter-svc", "configure": { "threshold": "{{value}}" } } }
```
`{{value}}` in the configure payload is replaced with the current numeric value. Works inside arrays too.

**level-meter** — vertical bar driven by a service notification:
```json
{ "type": "level-meter", "source": { "serviceUuid": "mic-svc", "path": "levelDb" },
  "min": -60, "max": 0, "unit": "dB", "thresholdKnobServiceUuid": "knob-svc" }
```

**canvas** — embeds the Canvas service's drawing surface:
```json
{ "type": "canvas", "serviceUuid": "canvas-svc" }
```

**xy-pad** — embeds the XY Pad service:
```json
{ "type": "xy-pad", "serviceUuid": "xy-pad-svc", "width": 400 }
```

**qr-code** — shows a QR code from a service notification:
```json
{ "type": "qr-code", "caption": "Scan to connect", "source": { "serviceUuid": "qr-svc", "path": "url" } }
```

**message-list** — scrolling message thread with optional inline composer:
```json
{ "type": "message-list", "grow": true,
  "source": { "serviceUuid": "monitor-svc" },
  "composer": { "placeholder": "Type a message…", "submitLabel": "Send",
    "action": { "serviceUuid": "input-svc", "configure": { "inject": "$$input" } } } }
```

**status-indicator** — shows a coloured dot based on service state:
```json
{ "type": "status-indicator", "source": { "serviceUuid": "svc", "path": "status" },
  "statusColors": { "ok": "green", "error": "red" } }
```

**file-pick** — file chooser that sends the file to a service:
```json
{ "type": "file-pick", "label": "Choose file", "accept": ".wav,.mp3",
  "action": { "serviceUuid": "file-svc" } }
```

### Source object (for read widgets)

```json
{ "serviceUuid": "some-svc", "path": "nested.key" }
```

`path` is optional dot-notation into the notification object. Omit it to use the full
notification value.

---

## Step 6 — Register as a demo board (optional)

If this board should appear in the Meander app demo list, add it to
`meander/frontend/src/demoBoards.ts`:

```typescript
import myBoard from "../../../hkp-frontend/boards/my-board.json";

// Add to DEMO_BOARDS array:
{
  label: "My App",
  description: "One sentence describing what it does",
  icon: "🔧",
  board: myBoard as unknown as BoardDescriptor,
}
```

---

## Quality checklist before finishing

- [ ] Every `serviceUuid` referenced in the facade exists as a `uuid` in the services list
- [ ] Runtime IDs in `services` map match the IDs declared in `runtimes` array
- [ ] Service IDs are looked up from docs, not guessed
- [ ] Remote runtimes have a `url` field
- [ ] UUIDs are descriptive and end in `-svc`
- [ ] The board does something useful with a fresh load (no manual steps required to see it work, or clear first-run instructions in the facade)
