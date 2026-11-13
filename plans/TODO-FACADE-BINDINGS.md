# Facade bindings — what a widget sends to and shows from

A board is observable from the inside: every service has a panel, and the flow
inspector shows what each call was given and what it passed on. A **facade**
hides exactly that. Someone using a board they did not write sees a button and a
text field, not a service. They can't tell which service the button reaches or
where the text comes from. So they can't tell which flow inspector to open, and
the inspector's answers never reach them.

This plan makes the relation between a widget and the services it touches
discoverable **from the facade itself**, in both directions, plus the facade
state that carries values between widgets.

Raised 2026-11-13. Steps 1–6 built 2026-11-13; steps 7–9 open.

---

## What prompted it

A facade reaches a service in two ways, and only one of them is observed today:

- **`process`** is visible. `processService` (`hkp-frontend/src/facade/boardServices.ts`)
  starts the run *at* the service (`scope.next(svc, payload, run, false)`), so
  the service reports the payload as its input. On a remote runtime,
  `processAt` in hkp-node does the same. This was checked with a test against
  a browser Monitor with Capture mode on. But nothing says the input came from a
  widget, and nothing points a person at that service.
- **`configure`** is not reported at all. A service that then emits shows an
  output with no input (`reportAndContinue` in `BrowserRuntimeApp.ts`), so the
  inspector shows the effect without its cause.

Recording configure (and the origin of a run) only helps once a person knows
which service's inspector to open. So the binding comes first, and the inspector
work builds on it (steps 7 and 8).

---

## Decided

**Both directions are discoverable in the facade.** It's where a person who
didn't write the board starts. "What does this button reach" and "where does this
text come from" are both asked of a widget, so both are answered on the widget.

**Only in the board + facade view.** The badges and overlays appear when both
the facade and the runtimes are on screen (`FacadeViewApi.showFacade &&
showRuntime`). The fullscreen, app-like facade view is unchanged. A board's
member never sees them: a member hosts no runtime and is sent only a projection
of the facade, which holds no board internals to point at.

**A badge on every widget.** It's a small corner badge positioned over the
widget, so the layout never shifts. It is faint until the widget is hovered or
focused, and always visible on touch. The badge takes clicks only on its own
area, so a canvas or XY pad under it keeps working. It sits on leaf widgets,
and on each item of a repeat, because a repeat's bindings differ per item.
Containers get none.

**The overlay has two tabs: "Sends to" and "Shows from".** They are named from
the widget's side. "Inputs / Outputs" was rejected because the flow inspector
already uses those words from the *service's* side, and the two would point
opposite ways (a button's output is a service's input).

**What each binding in the list shows:**

- the verb or path: `process`, `configure level`, `reads error`
- the service's name, with where it lives as a breadcrumb:
  `Node › Switch › case "paid" › Mailer`, which tells two services of the same
  name apart before anybody jumps
- **Show in board**: brings the service's frame into view, opening every nested
  pipeline above it, and highlights it
- **Inspect**: does the same, then opens the flow inspector on the matching
  side, Input for a "Sends to" binding and Output for a "Shows from" binding
- a state when the binding cannot be resolved: the service is missing, it is
  inside a block use (the binding then points at the use as a whole, as the
  board does), or its remote runtime is not attached

**Facade state is a hop of its own.** A text input that `set-state`s `name`
reaches no service, yet a button's payload carries the value with `{ "$state":
"name" }`. Bindings list state keys too: the input's "Sends to" shows `facade
state "name"`, and the button's "Shows from" shows that it reads it. Resolving a
state binding points at the *other widgets* that read or write the key, not
at the board.

**The facade gets a badge of its own.** Some bindings have no widget: init
actions run when the facade opens, and notices are toasts. A badge in the
facade's chrome opens the same kind of overlay with the tabs **Runs on open**
(the facade's `init` actions), **Notices from** (each notice's `source`) and
**State** (below).

**Facade state can be looked at, at any moment.** It is how one widget reaches
another, yet nothing outside the facade editor shows it. The facade editor's
`StatePanel` (`hkp-frontend/src/facade/editor/StatePanel.tsx`) lists current
values, but only while the editor is open, and nothing about who wrote a value or
when. The State tab shows, for each key, its current value, the widgets that
write it and the widgets and actions that read it, and its recent writes
(when, what, by which widget).

**Mobile comes later.** The mobile canvas has no board + facade view, so a
badge there would have no board to jump to. Its flow sheet
(`views/playground/mobile/FlowSheet.tsx`) is the likely target once the
desktop version has settled.

---

## Steps

### 1. `widgetBindings`: bindings with their role

A pure function from a widget to what it binds, replacing the role-less
`widgetServiceUuids` (`hkp-frontend/src/facade/widgetServices.ts`), which
then becomes a projection of it. There is one walker, so the two cannot
disagree.

```ts
type Binding =
  | { role: "sends"; service: string; verb: "configure"; keys: string[] }
  | { role: "sends"; service: string; verb: "process" }
  | { role: "shows"; service: string; path?: string }
  | { role: "sends"; state: string }   // set-state
  | { role: "shows"; state: string };  // a { "$state": … } read
```

- **Sends to:** `action`, each `configure` or `process` entry in `actions`,
  and `set-state`.
- **Shows from:** `source` (service and `path`), the secondary references
  (`progressServiceUuid`, `thresholdKnobServiceUuid`), and every `$state`
  reference in a widget's value, items, summary or payload.
- **Embedded surfaces** (`canvas`, `camera`, `xy-pad`, `detect`) name a bare
  `serviceUuid`. Which tab they belong in depends on the widget (a camera sends
  frames, a canvas shows a drawing), so it comes from a small per-type table.
  That table is the one place where discovery is by type rather than by shape.
- **Not bindings**, as `widgetServiceUuids` already holds: a uuid inside a
  `configure` or `process` payload is a value being sent, not an address. A
  repeat's template binds nothing until an item is substituted into it. Its
  bindings are taken per item, after interpolation.
- The facade-level counterpart is `facadeBindings(facade)`: init actions,
  notices, and an index of every state key to the widgets writing and reading
  it, which steps 5 and 6 read.

Tests: every widget type has a case, including a repeat item and a nested
scoped address.

**Built 2026-11-13** in `hkp-frontend/src/facade/bindings.ts`, tested in
`facade/tests/bindings.test.ts`; `widgetServiceUuids` is now
`bindingServices(widgetBindings(item))`. What building it settled:

- There is no `facade.schema.json`. Completeness is held by `DISCOVERY`, a
  table over every `FacadeWidget["type"]` saying "by shape" or naming its
  surface. The build's `tsc` makes a new widget add an entry, and the test
  fails for an entry without a case. (Test files are not type-checked, so the
  table lives in source.)
- Two verbs beyond the sketch above: `send` for the file-pick, whose `action`
  names only a service and hands it the file through the service's own `send`,
  and `surface` for the camera, which captures and passes frames on. A "shows"
  binding may carry `surface: true` (canvas, detect, xy-pad).
- The XY pad is in both tabs for now: it shows its service's surface and
  configures it with `position` and `eventType`. This is the provisional answer
  to the first open question below.
- `selectable` on a data table or swimlane is a state write, to
  `selectionState` or the shared default `"selection"`.
- `confirm` and `prompt` steps bind only the state their question reads;
  `board` and `show-panel` bind nothing (the open question on navigation-only
  actions stands).
- A container binds what its `summary` reads. A repeat binds where its items
  come from (`source` or `items: { "$state" }`), and its template is not
  walked by `widgetBindings`.
- `facadeBindings(facade)` gives `init` (the actions that bind, by index),
  `notices` (each source), and `state`: per key, whether `facade.state` seeds
  it, and its writers and readers as `BindingSite`s. A widget's site is its
  panel and layout path (`siteKey` gives `"<panel>/<path>"`), the stable key
  steps 4, 6, 7 and 8 need. A repeat's template counts as one site
  (`…/template`), since a key it names is the same for every item.

### 2. Where a service lives

The breadcrumb, and whether a binding resolves at all, from the board context:
runtime name, the hosts above the service with their labels, and the
unresolved states (missing: `useMissingServices`; inside a use:
`blockUseContaining`; not reachable: `canReachService`). The overview already
derives ancestry and labels (`overview/graph.ts`, `OverviewNode.ancestry`,
`labelFor`). This step reuses that derivation rather than writing a second one.

**Built 2026-11-13** in `hkp-frontend/src/facade/serviceLocation.ts`, tested in
`facade/tests/serviceLocation.test.ts`:

- The overview's scene derivation (reading the board's shape, then
  `buildScene`) moved out of `OverviewView` into `overview/useBoardScene.ts`,
  which both use. It also says whether the reported shape has arrived
  (`settled`), so "not read yet" and "not there" can be told apart.
- A facade address is an `OverviewNode.key`, so `locateService` looks the
  address up in the scene, in runtime order as `findService` does. It returns
  one of `found`, `unreachable` (`canReachService` says no), `inside-use`
  (`blockUseContaining`, pointing at the use's own node), `missing`, or
  `pending` (the scene is not settled yet). It does not use the polling
  `useMissingServices`: the scene answers the same question for every
  binding at once.
- The breadcrumb is the runtime, then each host, then the service. A host's
  pipeline is named only when it is not the default `pipeline`, as with a
  Switch's case. `revealTargetOf(location)` turns a location into what step 3
  reveals.
- `useServiceLocations(boardContext, addresses, enabled)` is the hook for step
  4. It reads the board's shape only while `enabled`, because that asks every
  service for its configuration.

### 3. One way to reveal a service

`revealService` in `overview/OverviewView.tsx` opens nested pipelines outermost
first, waits for the frame, scrolls to it and highlights it. `revealServiceFrame`
in `assets/AssetView.tsx` is a copy that only reaches top-level services.
Extract the overview's version into one shared helper. The asset view moves to
it and so gains nested services.

**Inspect** needs the flow inspector to be opened from outside its frame. Today
`ServiceFrame` owns the popup's open state. Add a way to ask a frame by uuid to
open its inspector on a given side. With Capture mode off, the inspector would
show calls without their values, so Inspect says so and offers to switch it on.

**Built 2026-11-13:**

- `runtime/ui/revealService.ts` has `revealService(target, navigation, { inspect })`,
  the overview's version made generic over a `RevealTarget` (`uuid`,
  `ancestry`, `hostLabel`). The overview and the asset view both use it now.
  The asset view gets nested services through `revealTargetAlong(service,
  path)`, which follows an asset use's path through the service entries it
  passes. Tested in `runtime/ui/revealService.test.ts`.
- `ui-components/service/inspectorRequests.ts` has `requestInspector(uuid, side)`.
  `ServiceOutputPlug` now takes the frame's `uuid` and listens for requests.
  A request that arrives before the frame has mounted waits up to the reveal
  timeout (2 s) and then lapses. Where two frames share a uuid, the first one
  listening takes it.
- Capture mode off: a request goes through the plug's own opening, so it asks
  first with the existing "Capture mode is off" dialog. That settles the open
  question below.
- The facade is rendered inside the playground's `NestedNavProvider` (through
  `BoardCanvas`), so a widget can open nested levels just as the overview does.
  When the overview or the asset view is covering the runtimes, Show in board
  has to close it first. That belongs to step 4.

### 4. Widget badge and overlay

In `facade/panels/LayoutNode.tsx`, which already computes each node's services
and the missing ones, render the badge and its overlay from `widgetBindings`
when the view shows both facade and runtimes. Repeat items take theirs after
interpolation.

**Built 2026-11-13.** `facade/panels/BindingsBadge.tsx` holds the badge and
overlay, and `facade/FacadeBindingsContext.tsx` the provider. Tested in
`facade/tests/bindingsBadge.test.tsx`, and looked at in the real playground
with a throwaway Playwright run.

- `FacadeBindingsProvider` sits in `FacadeRenderer`. It is enabled only when a
  view provider is mounted and both halves are on screen. Without it no badge
  is drawn, which covers the fullscreen facade, a member's view and the
  mobile view. The board's shape is read once for the whole facade, and only
  when an overlay opens (`useBoardScene`'s new `generation`). Each opening
  reads it again.
- `LayoutNode` takes a `site` (panel and layout path) from `GenericPanel`.
  Every leaf's wrapper carries it as `data-facade-site`, which is how a state
  binding brings another widget into view. Repeat items share the template's
  site.
- A badge appears only on a leaf that binds something. A widget with no
  bindings, such as a static note, has nothing to show. The repeat node itself
  gets no badge (it counts as a container); its items do. Where a repeat's
  items come from is therefore not shown yet.
- **Placement.** A leaf's wrapper stretches across its column, so its corner
  is far from the widget. The badge is measured against what the widget
  actually draws: its childless elements, with text measured by its own
  extent, and controls (buttons, inputs, canvases) by their whole box. The badge is
  centred on the content's top-right corner, so only its bottom-left quarter
  lies over the widget. That matters most for a button, where a badge on its
  face caused misclicks. Inside a wrapper that clips (`overflow: hidden`), it
  is kept within the wrapper. Layout is unchanged. It re-measures on resize,
  once web fonts have loaded, and on hover. Past 400 elements it falls back to
  the wrapper's corner.
- **A collapsed runtime is expanded first.** `RevealTarget` carries the
  service's `runtimeId`, and `revealService` asks that runtime to expand
  (`ui-components/runtime-ui/runtimeRequests.ts`, listened to in
  `components/Runtime.tsx`). It only scrolls to a frame once the frame is laid
  out, and it outlines the service's card rather than the whole frame. The
  frame also holds the flow inspector's plug, which nobody reads as part of
  the service. The overview and the asset view get this too. The inspector and runtime
  requests share one mechanism, `ui-components/requestChannel.ts`.
- The overlay uses the `.hkp-binding-*` styles in `index.css`. The popover's
  own `bg-popover` token is not defined in the playground themes, so the
  overlay sets its surface explicitly.
- **Found in the real app:** the playground's nested levels are drawn over the
  whole canvas, and the facade is part of it. So Show in board or Inspect on a
  nested service replaces the facade with that level until the breadcrumb
  leads back. Top-level services reveal in place. Whether a level should cover
  only the runtime half in the board + facade view is a new open question.

### 5. Facade badge

In the facade's chrome (`FacadeChrome.tsx`): **Runs on open**, **Notices from**
and **State**, from `facadeBindings`.

**Built 2026-11-13** in `facade/FacadeBindingsBadge.tsx`, tested in
`facade/tests/facadeBindingsBadge.test.tsx`, and looked at in the real
playground.

- **Not in `FacadeChrome`.** That is the app's toolbar, which retracts when the
  facade is shown alone. It sits outside `FacadeRenderer`, where the bindings
  context lives. The badge is a "Facade" chip on the divider between the
  facade and the board instead. The divider only exists while both are on
  screen, it is where the facade meets the board, and nothing on it can be
  covered. Pressing the chip does not start a divider drag.
- The rows are shared with the widget badge (`facade/panels/BindingRows.tsx`:
  `ServiceRow`, `StateRow`, `SiteLinks`, `OverlayTabs`, `verbOf`), so both
  overlays describe a binding the same way.
- **Runs on open** lists each init action's bindings, with Show in board and
  Inspect. **Notices from** lists each notice's source and what it raises.
  `facadeBindings` now carries a notice's `tone` and `message` for this.
- **State** already shows what step 6 asks for, apart from the history: per
  key, its current value, whether `facade.state` seeds it, and its writers and
  readers as links to their widgets. It also lists keys held in state that
  nothing in the facade names.

### 6. Facade state view

The State tab, and the facade editor's `StatePanel` shown from the same
component (step 5 already gives the State tab current values, writers and
readers; what is left is the history, the writer's identity, and sharing the
component with `StatePanel`):

- current value per key, writers and readers from `facadeBindings`, each
  resolvable to its widget
- recent writes per key: time, value, writing widget. Kept in memory for this
  window, bounded like the flow inspector's history (`MAX_HISTORY` in
  `flowRecords.ts`)

Knowing who wrote a value means `setState` learns the writer: `executeActions`
is told which widget it runs for. A widget without an `id` needs a stable key
(its panel and position in the layout), which steps 4, 7 and 8 use as well.

**Built 2026-11-13** in `facade/FacadeStateView.tsx`, tested in
`facade/tests/facadeStateHistory.test.tsx`, and looked at in the real
playground.

- **One view.** `FacadeStateView` is the badge's State tab and the editor's
  `StatePanel`. The editor builds its own index from the draft facade, since
  the bindings context exists only in the board + facade view. In the editor,
  widgets are named but not linked.
- **History.** The store (`FacadeRenderer`) keeps `history` beside `state`:
  per key, the latest writes, newest first, each with `at`, `value` and
  `writer` (`recordWrite`, bounded by the flow inspector's `MAX_HISTORY`, now
  exported). It is cleared when another board opens and is not kept across
  reloads. It shows as "Recent writes" under each key.
- **The writer, without telling `executeActions` about widgets.**
  `LayoutNode` hands each widget a `FacadeStateContext` whose `setState`
  already carries the widget's site. That covers everything the widget
  writes, whether through its actions or by itself (a table's or a swimlane's
  selection), and no renderer needs to change. A repeat item writes as the
  template's site, labelled with the item's own label. Init actions have no
  widget: `executeActions` now passes a set-state step's position in
  `actions` as a third argument to `setState`, and `FacadeRenderer` turns it
  into `{ kind: "init", index }`, shown as "by the facade on open". Widget
  actions drop that argument (`useWidgetActions`).
- A value reads as JSON, cut at 160 characters, and "not set" when it has
  none. The editor previously showed "—" for that.

### 7. Origin on runs

An optional `origin` on `ProcessContext`, `{ kind: "facade", widget }`, set when
`executeActions` mints the run. The entry service's `call-process` report
carries it, and the inspector labels that input "from facade · Book". It is a
label for display: no runtime trusts it, and `caller` stays the authority. The
browser runtime goes first. The remote runtimes copy it from `__context` into
the report for the start service afterwards.

With origin in place a display's value traces back too: the text field shows
from a service, whose call came from a run, which a button began.

### 8. Configure as a reported event

A third report, `{ __internal: { state: "configured", data, origin } }`, bounded
by `outgoingPayload` under Capture mode like any call report. It is emitted by
the facade's dispatch, which knows what it sent whatever runtime holds the
service. The renderers that call `configure()` directly (`KnobRenderer`,
`XYPadRenderer`, `MessageListRenderer`) move to `executeActions` first. They
currently skip its `$state` and `$user` resolution and `markBoardChanged`.

`readCallReport` and `rememberFlow` learn the new entry. The inspector shows it
in the Input timeline as a marker ("Configured: `{level: 0.7}`"), whose action
is to re-apply it rather than rerun it. `overview/activity.ts` reads the same
reports and picks it up.

### 9. Docs

The facade's part of `docs/content/board-json.md`, and the flow inspector's
description, say what bindings are and where they are shown. New terms for the
vocabulary (`docs/content/vocabulary.md`) are proposed to its owner, not added:
the vocabulary is written by hand.

---

## Open questions

- **Embedded surfaces.** Which tab each of `canvas`, `camera`, `xy-pad` and
  `detect` belongs in, or both. The XY pad embeds the service's surface *and*
  configures it with the position. Step 1 puts camera in "Sends to", canvas and
  detect in "Shows from", and the XY pad in both; revisit once the overlay is
  on screen.
- **Navigation-only actions.** Should `show-panel` and `board` actions be listed?
  They reach no service, but they are what a button does.
- ~~**Inspect with Capture mode off.** Switch it on directly, or ask first?~~
  Ask first, using the plug's existing dialog (step 3).
- **The reverse listing on a service frame.** Listing on a service the widgets
  bound to it is cheap once step 1 exists. It isn't needed for the facade-first
  goal, and it is not decided whether it belongs.
- **Nested levels over the facade.** Opening a nested level from a binding
  covers the facade too (step 4). Should levels open in the runtime half only
  while the facade is on screen?
- **Where a repeat's items come from.** The repeat node draws no badge, so a
  repeat reading its items from a service or a state key does not show it.
  Badge the repeat, or list it on each item's badge?
- **Writes history across reloads.** Facade state lives only while the facade is
  on screen, so the history is assumed to as well.
