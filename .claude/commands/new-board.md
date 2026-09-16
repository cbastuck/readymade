---
description: Design and generate a complete Readymade board JSON from a description — runtimes, services, wiring, and optional facade
allowed-tools: Read, Write, Edit, Bash
---

# New Board

You are designing a complete Readymade board from a description. A board is the top-level artifact
in Readymade — it declares runtimes, wires services through them, and optionally defines a facade
that gives users a polished app-like interface on top.

Work through these steps in order. Ask focused questions only where the goal is genuinely
ambiguous.

---

## Step 1 — Understand the goal

Before designing anything, establish:

- What should the board _do_ from the user's perspective?
- What data flows through it and in which direction?
- Does it need real-time/streaming data, or is it event-driven?
- Who is the audience — the builder themselves, or other (non-technical) users?

The last question determines whether a facade is needed.

---

## Step 2 — Choose runtimes

Pick the minimum set of runtimes that covers the domains involved:

| If you need…                                                   | Use runtime         |
| -------------------------------------------------------------- | ------------------- |
| UI, browser APIs, WebRTC, camera, audio Web API                | Browser             |
| Messaging (Telegram, SMTP, IMAP), HTTP server, file I/O        | Node.js (hkp-node)  |
| Audio DSP (FFT, IFFT, WAV, ring buffers), high-performance C++ | hkp-rt              |
| AI/ML, Python-native open-source models                        | Python (hkp-python) |

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
  "runtimes": [
    {
      "id": "ui",
      "name": "Browser",
      "type": "browser",
      "state": { "wrapServices": false }
    }
  ],
  "services": {
    "ui": [
      {
        "uuid": "source-svc",
        "serviceId": "hookup.to/service/injector",
        "serviceName": "Source",
        "state": {}
      },
      {
        "uuid": "transform-svc",
        "serviceId": "hookup.to/service/map",
        "serviceName": "Transform",
        "state": {}
      },
      {
        "uuid": "output-svc",
        "serviceId": "hookup.to/service/monitor",
        "serviceName": "Output"
      }
    ]
  }
}
```

**Browser → Node → Browser** — node processes in the middle:

```json
{
  "runtimes": [
    {
      "id": "ui-in",
      "name": "Browser",
      "type": "browser",
      "state": { "wrapServices": false }
    },
    {
      "id": "node",
      "name": "Node",
      "type": "rest",
      "url": "http://127.0.0.1:8080",
      "state": { "wrapServices": false }
    },
    {
      "id": "ui-out",
      "name": "Result",
      "type": "browser",
      "state": { "wrapServices": false }
    }
  ],
  "services": {
    "ui-in": [
      /* trigger or input services */
    ],
    "node": [
      /* node services */
    ],
    "ui-out": [
      /* display services */
    ]
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

### Tabs — one board, more than one job

Most boards are used by two people who are not the same person, or by the same person at
two moments: the feeds are subscribed to once and read every day; a poll's dates are put
up by whoever called the meeting and answered by everyone else. Controls for the other job
are not neutral — they are in the way, and they invite a change nobody meant to make.

```json
{
  "layout": "columns",
  "panels": [ /* declared once, as always */ ],
  "tabs": [
    { "id": "read",  "title": "Read",  "panels": ["articles", "saved"] },
    { "id": "feeds", "title": "Feeds", "panels": ["library"] }
  ],
  "defaultTab": "read"
}
```

A tab is a view over the panels the facade already has: it names panel ids, and a panel is
still declared once in `panels`. Two panels in one tab sit side by side exactly as a
`columns` facade's panels do — and a panel can say how much of that row it wants:

```json
{ "id": "articles", "title": "Latest", "width": "70%", "layout": { ...LayoutItem } }
```

`width` is a **share of the row, not a size** ("70%", or the bare number that means the
same). Declare one on each panel that shares a row when you know which of them matters —
an even split is otherwise what every facade opens as. It is only a starting point: the
divider still moves, what a reader leaves it at is what that board opens as next time, and
double-clicking the divider puts the board's own split back. Ignored on mobile, where
panels stack.

- **`defaultTab` is the tab for the many, not the few.** Boards open on using, not on
  setting up. It is not remembered between visits, so this is what every reader gets.
- **A panel no tab names stays on screen**, above the tab bar, whichever tab is chosen —
  for the one status strip a board always wants read.
- Switching tabs hides a panel rather than discarding it: a half-typed field and a table's
  rows are still there when it comes back.

### Notices — say it, do not reserve room for it

A row kept free for a problem the board usually does not have spends layout on nothing, and
on the rare occasion it fills it speaks from wherever it happens to sit — which on a long
panel is past the bottom of the screen. Declare a notice instead and it arrives as a toast,
where the rest of the app's notifications arrive:

```json
"notices": [
  { "source": { "serviceUuid": "take-hour", "path": "error" } },
  {
    "source": { "serviceUuid": "feeds", "path": "error" },
    "tone": "info",
    "message": "Could not read that feed — {{value}}"
  }
]
```

A notice reads a service the way a widget's `source` does and fires whenever that value
arrives with something in it — so a service reporting `error: ""` on every good run can be
watched all day without saying a word. `tone` is `"error"` by default; `message` wraps the
value, with `{{value}}` standing for it.

It never seeds from what a service already holds: a failure from before the board was open
is not news. Point one at every service that can refuse what a person asked for — the
writes especially, since a refused write is otherwise silent.

### LayoutItem — container or widget

A **container** groups children:

```json
{
  "direction": "row | column",
  "gap": 12,
  "padding": 16,
  "paddingX": 16,
  "paddingY": 12,
  "align": "center",
  "justify": "center",
  "fill": true,
  "wrap": false,
  "items": [ ...LayoutItem[] ]
}
```

`padding` is both axes; `paddingX` and `paddingY` override one of them. A panel's own root
container is where this usually matters — a facade draws no margin of its own, so a column
whose layout says nothing sits flush against the panel edge and, in a `columns` facade, against
the divider between it and its neighbour. `paddingX` alone gives it room at the sides without
pushing its first widget down from the panel's title.

A container can **fold**, which is how a panel keeps controls that are occasionally needed from
pushing the ones that always are off the bottom of the screen:

```json
{
  "direction": "column",
  "collapsible": true,
  "title": "Headers",
  "summary": { "serviceUuid": "request-svc", "path": "headers" },
  "open": false,
  "items": [ ...LayoutItem[] ]
}
```

`title` is required — a row that does not say what it hides is worse than the space it saved.
`summary` reads a service notification the way a widget's `source` does, or a facade state key
(`{ "$state": "body" }`), and shows a count beside the title: an object or array reports its
size, anything else its text. Give every fold one, so a setting made and then hidden still
announces itself.

A **widget leaf** has a `type` field. All widgets may also carry `"grow": true` to fill
remaining space in their parent container.

### Widget types

**button** — sends a configure payload to a service. An optional `indicator` renders a live
dot left of the label, driven by a service notification (values are matched via `String(value)`,
so booleans work):

```json
{
  "type": "button",
  "label": "Start",
  "action": { "serviceUuid": "timer-svc", "configure": { "start": true } },
  "indicator": {
    "source": { "serviceUuid": "mic-svc", "path": "isRecording" },
    "statusColors": { "true": "#ef4444", "false": "#6b7280" }
  }
}
```

`confirm` makes the button ask before it acts, in the facade's own dialog. Use it where the
action is not one to take on a single tap — it spends money, sends something, or gives
something away. Word it as what will happen, not as *are you sure*:

```json
{
  "type": "button",
  "label": "free",
  "confirm": "Book court 2 at 12:00 on 2026-09-17?",
  "disabled": false,
  "actions": [{ "type": "process", "serviceUuid": "book-svc", "payload": { "court": 2 } }]
}
```

`disabled` renders the button present but not offering anything — a slot already taken, a
step not yet reachable. Prefer it to leaving the button out when the gap would say less
than the dimmed control does. Both fields are ordinary values, so inside a `repeat` they
can come from the item.

A button may instead carry an `actions` array, which is where the things a button
does that are not "configure one service" live. A **set-state action** with a written
`value` is how a button *picks* something rather than acting on it — the choice goes into
facade state, where the panel's other widgets read it:

```json
{
  "type": "button",
  "label": "{{item.label}}",
  "actions": [
    { "type": "set-state", "key": "poll", "value": "{{item.name}}" },
    { "type": "process", "serviceUuid": "open-poll", "payload": { "poll": "{{item.name}}" } }
  ]
}
```

Written rather than read off the widget, because a button has no value of its own: a
`repeat` over a list of things could otherwise be rendered and never picked from. Pass the
choice to the actions beside it as the item reference, not as `{ "$state": … }` — the state
lands after the pass they run in, so a reference there would still send the *previous*
choice.

A **board action** names no service
at all — its subject is the board, and what it does is decided by the host showing
the facade, not by the board:

```json
{
  "type": "button",
  "label": "Invite partner…",
  "actions": [{ "type": "board", "action": "partner-board-qr" }]
}
```

`partner-board-qr` shows a QR for the board that connects back to this one: the same
board with its `peer-socket` roles swapped and its machine-local runtimes dropped.
Put it on a board whose two sides are halves of one design, as
`peer-chat-board.json` does. A host that cannot open such a window leaves the button
inert rather than failing, so the board still renders everywhere.

**text-input** — text field that configures a service on submit. `$$input` is replaced with the typed value:

```json
{
  "type": "text-input",
  "label": "Topic",
  "placeholder": "my-topic",
  "submitLabel": "Set",
  "action": {
    "serviceUuid": "notifier-svc",
    "configure": { "url": "https://ntfy.sh/$$input" }
  }
}
```

`defaultValue` gives the field a real starting value (not a placeholder — it is what submitting
sends). Reach for it whenever a board would otherwise come up inert waiting to be told something
it could have assumed: seed the same value in the facade's `state` so widgets reading
`{ "$state": … }` agree with what the field shows.

**knob** — rotary control with optional markers and live readout:

```json
{
  "type": "knob",
  "label": "Threshold",
  "min": -60,
  "max": 0,
  "defaultValue": -12,
  "unit": "dB",
  "width": 130,
  "height": 110,
  "showValue": true,
  "markers": [{ "value": -20, "text": "loud" }],
  "action": {
    "serviceUuid": "filter-svc",
    "configure": { "threshold": "{{value}}" }
  }
}
```

`{{value}}` in the configure payload is replaced with the current numeric value. Works inside arrays too.

A panel holds each knob's position under its `id`, falling back to the service uuid. Two knobs
driving the same service — the columns and rows of one image, say — therefore need an `id` each,
or they share one position and jump on the first drag.

**level-meter** — vertical bar driven by a service notification:

```json
{
  "type": "level-meter",
  "source": { "serviceUuid": "mic-svc", "path": "levelDb" },
  "min": -60,
  "max": 0,
  "unit": "dB",
  "thresholdKnobServiceUuid": "knob-svc"
}
```

**canvas** — embeds the Canvas service's drawing surface:

```json
{ "type": "canvas", "serviceUuid": "canvas-svc" }
```

**camera** — live camera, feeding frames to a Camera service:

```json
{
  "type": "camera",
  "serviceUuid": "camera-svc",
  "width": 320,
  "height": 200,
  "previewWidth": 132
}
```

`width`/`height` are the captured frame — what the pipeline receives — and `previewWidth` only
how large it is drawn here; `preview: false` captures without drawing it at all. A board whose
camera runs in a facade **needs** this widget: the Camera service captures through a video element
something on screen handed it, and a facade view draws no service panels.

**xy-pad** — embeds the XY Pad service:

```json
{ "type": "xy-pad", "serviceUuid": "xy-pad-svc", "width": 400 }
```

**qr-code** — shows a QR code from a service notification:

```json
{
  "type": "qr-code",
  "caption": "Scan to connect",
  "source": { "serviceUuid": "qr-svc", "path": "url" }
}
```

**message-list** — scrolling message thread with optional inline composer:

```json
{
  "type": "message-list",
  "grow": true,
  "source": { "serviceUuid": "monitor-svc" },
  "composer": {
    "placeholder": "Type a message…",
    "submitLabel": "Send",
    "action": {
      "serviceUuid": "input-svc",
      "configure": { "inject": "$$input" }
    }
  }
}
```

**status-indicator** — shows a coloured dot based on service state:

```json
{
  "type": "status-indicator",
  "source": { "serviceUuid": "svc", "path": "status" },
  "statusColors": { "ok": "green", "error": "red" }
}
```

**text** — whatever a service is saying, as text:

```json
{
  "type": "text",
  "label": "Cipher",
  "source": { "serviceUuid": "monitor-svc", "path": "ascii" },
  "mono": true,
  "copyable": true,
  "pretty": true,
  "wrap": false,
  "lineHeight": 0.62,
  "fontSize": 11,
  "placeholder": "Nothing yet."
}
```

`copyable` puts a copy button beside the value, for a value whose point is being taken somewhere
else. `wrap: false` keeps the value's own columns — ASCII art, a table a service drew itself —
and scrolls sideways instead of breaking lines; pair it with `lineHeight` near 0.62 so a
character cell comes out square and the picture is not stretched down the panel. `pretty`
indents an object value as JSON. Omit `source` entirely for a fixed line of prose: the
`placeholder` is then the whole text.

`href` makes the text a link, for a value that names something to open rather than something to
read — a headline, a document, a result. It opens in a new tab, and takes an item reference like
any other value, which is what gives each row of a `repeat` its own destination:

```json
{ "type": "text", "placeholder": "{{item.title}}", "href": "{{item.link}}", "grow": true }
```

Nothing is linked where there is nothing to click, so a widget whose source has not answered yet
shows its placeholder as plain text rather than as a link that goes nowhere.

**file-pick** — file chooser that sends the file to a service:

```json
{
  "type": "file-pick",
  "label": "Choose file",
  "accept": ".wav,.mp3",
  "action": { "serviceUuid": "file-svc" }
}
```

**calendar** — a day as a calendar: the hours down the side, one column per thing being booked
(a court, a room, a machine). Reach for this instead of building a grid out of `repeat` and
buttons whenever the *arrangement* is what carries the meaning — a person reads a timetable by
looking down a column, which only works if the hours line up and every row is the same height:

```json
{
  "type": "calendar",
  "source": { "serviceUuid": "day-grid", "path": "rows" },
  "columns": ["Court 1", "Court 2", "Court 3"],
  "fromHour": 7,
  "toHour": 21,
  "rowHeight": 32,
  "confirm": "{{item.prompt}}",
  "actions": [{
    "type": "process",
    "serviceUuid": "book-svc",
    "payload": {
      "state": "{{item.state}}",
      "court": "{{item.column}}",
      "hour": "{{item.hour}}"
    }
  }]
}
```

Each row is one cell and names its own position and meaning:

| Field | What it is |
|---|---|
| `column` | 1-based index of the column it sits in |
| `hour` | the hour it starts at |
| `state` | `free` \| `mine` \| `taken` \| `blocked` — how it is drawn, and whether it can be tapped (`free` and `mine` can be) |
| `label` | what it says; omitted, a default for the state is used (`free` → "+", `mine` → "You") |
| anything else | travels with the cell, readable by the payload as `{{item.…}}` |

`columns` names the headings; `fromHour`/`toHour` default to the hours the rows mention, and any
hour in between with no row is still drawn, so the axis never has gaps. `dayField` (default
`"day"`) names the field the calendar captions itself with.

`stripe` rules the hours the way a wide table is ruled — `{ "even": "rgba(127,127,127,0.10)",
"odd": "rgba(127,127,127,0.03)" }` — because a day three columns wide is read *across* one hour,
and a band is what keeps that line from drifting into the next. It runs the full width of the
row, gutter included, and a free hour draws no background of its own so the band reaches across
it; `taken` and `mine` keep the colours that say what they are.

**A free hour is drawn as a control**, with a solid border and a `+`; `blocked` is the only state
drawn as a faded outline. That contrast is the one a person actually needs — an empty outline for
both makes a bookable day look identical to a day with nothing on offer, and nothing on the
calendar then looks clickable at all.

**The widget draws; the query decides.** It works out nothing about availability — each cell
arrives already knowing whether it is on offer, because the query that answered knows who holds
what and a layout cannot. A `blocked` cell is the shape this takes in practice: an hour that is
free but not yours to take, which keeps its place in the column and simply stops offering
itself.

**repeat** — renders one copy of a template per item, for a set of controls the board cannot
write out by hand because it does not know how many there will be. Items come from one of
three places: a static array, a facade state key, or — with `source` — **whatever a service
is saying**, which is what turns a query result into a grid of controls rather than a table
to look at:

```json
{
  "type": "repeat",
  "source": { "serviceUuid": "day-grid", "path": "rows" },
  "columns": 4,
  "gap": 6,
  "template": {
    "type": "button",
    "label": "{{item.label}}",
    "confirm": "{{item.prompt}}",
    "disabled": "{{item.locked}}",
    "actions": [{
      "type": "process",
      "serviceUuid": "book-svc",
      "payload": { "court": "{{item.court}}", "hour": "{{item.hour}}" }
    }]
  }
}
```

`{{item}}` is the item itself and `{{item.field}}` a field of it (dotted paths allowed). A
value that is **exactly** one of those becomes that value whole, so a number stays a number
and an object stays an object — which is what lets the item decide a payload's values and
not merely a label's text. A reference inside a longer string is printed into it
(`"Court {{item.court}} at {{item.hour}}:00"`).

`columns` lays the items out in a CSS grid; without it they stack in a flex column, or a row
if `direction` is set. `items` wins where a board wrote one, so a `source` is a fallback
rather than something that can override what was written.

`stripe` puts alternating backgrounds behind the items, for a list whose template is more
than one line and would otherwise run together — where one article ends and the next begins
is not something a gap can say when the item has gaps of its own:

```json
"gap": 0,
"stripe": { "even": "rgba(127,127,127,0.10)", "odd": "rgba(127,127,127,0.03)", "padding": 10, "radius": 6 }
```

`even` is the first item and every second one after it. Use translucent colours: they tint
whatever the panel is drawn on and so hold up in a light and a dark theme alike, where a
fixed colour can only suit one of them. The bands are meant to touch, so set `gap` to 0 and
let `padding` do the spacing. A `calendar` takes the same `even`/`odd` pair for its hours.

**Have the service return the items already decided.** One query that emits them carrying their
own labels, their own payloads and whether they are on offer beats a facade trying to work any of
that out — there are no conditionals in a layout, and the service is where the rules already live.

For a timetable specifically, reach for **calendar** rather than a `repeat` with a column count:
a repeat of buttons can carry the same information and still not read as a calendar.

### Source object (for read widgets)

```json
{ "serviceUuid": "some-svc", "path": "nested.key" }
```

`path` is optional dot-notation into the notification object. Omit it to use the full
notification value.

---

## Step 6 — Register as a demo board (optional)

If this board should appear in the Readymade app demo list, add it to
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
- [ ] Controls for setting the board up are behind their own tab, and `defaultTab` names the one people use
- [ ] Panels sharing a row declare a `width` share where one of them plainly matters more
- [ ] Every service that can refuse a request has a notice on it, and no panel keeps a row free for an error
