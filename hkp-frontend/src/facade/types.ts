export type FacadeWidgetSource = {
  serviceUuid: string;
  // Optional dot-notation path into the notification object, e.g. "data.text".
  // When omitted the notification value itself is used.
  path?: string;
};

export type FacadeWidgetAction = {
  serviceUuid: string;
  // configure payload sent to the service.
  // The special sentinel string "$$input" is replaced with the current widget value.
  configure: Record<string, unknown>;
};

// Typed action entries for the new `actions` array on input widgets.
export type ConfigureAction = {
  type: "configure";
  serviceUuid: string;
  configure: Record<string, unknown>;
};

export type SetStateAction = {
  type: "set-state";
  // Facade state key to write. The widget's current value ($$input equivalent) is stored.
  key: string;
  // What to write instead, for a widget whose own value is not the thing being
  // published — a button standing for one item of a repeat, which is how a
  // board offers a choice between things it did not know at design time. It
  // takes an item reference like any other value, so the item decides it.
  //
  // Written rather than read from the widget because a button has no value: a
  // list of things to pick from could otherwise only be rendered, never picked
  // from.
  value?: unknown;
};

// Asks a service to do its job with a payload, running the pipeline from that
// service onward. Distinct from configuring it: configure says what a service
// *is*, this says do this now. Without it a board could only reach a service by
// writing into its configuration, which meant anything a button had to cause
// was smuggled in as a config field the service read as a command.
// `$$input` and { "$state": ... } are substituted the same way.
export type ProcessAction = {
  type: "process";
  serviceUuid: string;
  // Whatever the service takes, which is not always an object: a service whose
  // input is one value — a cipher to decrypt, a line to speak — is handed that
  // value, so the payload may be the bare "$$input" sentinel.
  payload?: unknown;
};

// Asks the board for something, rather than a service on it — so it names no
// service. What each action does, and whether the host showing the facade can
// do it at all, is decided outside the board; see facade/FacadeBoardActions.
export type BoardAction = {
  type: "board";
  // "partner-board-qr": shows a QR for the board that connects back to this
  // one, for a board whose peers are two halves of the same design.
  action: "partner-board-qr";
};

export type WidgetAction =
  ConfigureAction | SetStateAction | ProcessAction | BoardAction;

export type MessageListWidget = {
  type: "message-list";
  source: FacadeWidgetSource;
  // When present, renders an inline composer below the message thread.
  composer?: {
    placeholder?: string;
    submitLabel?: string;
    action: FacadeWidgetAction;
  };
};

export type TextInputWidget = {
  type: "text-input";
  label?: string;
  placeholder?: string;
  // What the field starts out holding, for a board that has a sensible answer
  // and would rather work on first load than wait to be told. Unlike a
  // placeholder this is a real value: it is what submitting sends. Pair it with
  // the same value in the facade's initial state where other widgets read it.
  defaultValue?: string;
  submitLabel?: string;
  secret?: boolean;
  vaultKey?: string;
  // Overrides the default 360px cap so the field fills its layout slot. Set by
  // the layout `width` when the input sits in a sized row/column.
  width?: number | string;
  action?: FacadeWidgetAction;
  actions?: WidgetAction[];
};

export type JsonInputWidget = {
  type: "json-input";
  label?: string;
  // Constrains and initializes the root value type.
  mode: "array" | "object";
  // Optional seed value shown on first render. Accepts a { "$state": "key" } reference.
  defaultValue?: unknown;
  submitLabel?: string;
  action?: FacadeWidgetAction;
  actions?: WidgetAction[];
  width?: number | string;
};

export type StatusIndicatorWidget = {
  type: "status-indicator";
  source: FacadeWidgetSource;
  statusColors?: Record<string, string>;
};

// Renders whatever a service is saying, as text. The one widget whose subject
// is the value itself rather than a shape derived from it — a reason, a
// summary, a count. Reads its source like status-indicator, so it shows what
// the service already holds rather than waiting for the next notification.
export type TextWidget = {
  type: "text";
  // Absent for a line that says the same thing whatever the board is doing —
  // a note on what a control is for. The `placeholder` is then the whole text,
  // since there is never a value to replace it.
  source?: FacadeWidgetSource;
  // Offers the value for the clipboard, for a value whose point is being taken
  // somewhere else rather than read.
  copyable?: boolean;
  // false keeps the value's own columns: lines are not broken to fit, and the
  // block scrolls sideways instead. For a value laid out in characters, where a
  // wrapped line is a wrong line.
  wrap?: boolean;
  // Line spacing, for a value whose lines belong together as a block rather
  // than reading as prose.
  lineHeight?: number;
  // Static caption rendered, muted, before the value — what the value is, where
  // the value alone would not say (e.g. "You:" in front of a peer name).
  label?: string;
  // Shown, muted, while the source has nothing to say.
  placeholder?: string;
  tone?: "normal" | "muted" | "error";
  fontSize?: number;
  mono?: boolean;
  // Indents an object value as JSON over several lines, for a value that is a
  // structure to read rather than a phrase to mention — a response body, a map
  // of headers. Strings are unaffected.
  pretty?: boolean;
  // Makes the text a link to somewhere else, for a value that names something
  // to open rather than something to read — a headline, a document, a result.
  // Opens in a new tab, since the facade is the app and the target is not.
  //
  // An option on this widget rather than a widget of its own: what is rendered
  // is still whatever a service is saying, and a board that turns out not to
  // have an address to open drops one field instead of changing widgets. It
  // takes an item reference like any other value, which is what lets a repeat
  // over a list of things give each one its own destination.
  href?: string;
};

export type ButtonWidget = {
  type: "button";
  label: string;
  // Asks before doing it. The text is the question a person answers, so it
  // names what will happen ("Cancel your booking on court 2 at 12:00?") rather
  // than asking whether they are sure. Nothing runs unless they agree.
  //
  // Consent belongs to the action rather than to a dialog widget of its own:
  // a button already holds what it will do, and this is a property of doing it.
  confirm?: string;
  // A button that is present but not offering anything — a slot already taken,
  // a step not yet reachable. It still says what it is, which is why it stays
  // on the page instead of being left out: the gap would say less than the
  // disabled control does.
  disabled?: boolean;
  // Optional live dot rendered left of the label, driven by a service
  // notification (e.g. a microphone's isRecording flag).
  indicator?: {
    source: FacadeWidgetSource;
    statusColors?: Record<string, string>;
  };
  action?: FacadeWidgetAction;
  actions?: WidgetAction[];
};

export type QrCodeWidget = {
  type: "qr-code";
  source: FacadeWidgetSource;
  caption?: string;
};

export type FilePickWidget = {
  type: "file-pick";
  label?: string;
  accept?: string;
  progressServiceUuid?: string;
  action: {
    serviceUuid: string;
  };
};

export type KnobMarker = {
  value: number;
  // Display text. Use "\n" to split across two lines on the knob face.
  text: string;
};

export type LevelMeterWidget = {
  type: "level-meter";
  source: FacadeWidgetSource;
  min?: number;
  max?: number;
  unit?: string;
  // serviceUuid of the knob whose current value is drawn as a threshold line.
  thresholdKnobServiceUuid?: string;
};

export type BipolarMeterWidget = {
  type: "bipolar-meter";
  source: FacadeWidgetSource;
  label?: string;
  width?: number;
  height?: number;
};

export type KnobWidget = {
  type: "knob";
  // Distinguishes this knob from another one driving the same service — a
  // panel holds each knob's position under this key. Defaults to the service
  // uuid, which is also what `level-meter` names in
  // `thresholdKnobServiceUuid`, so two knobs on one service need ids.
  id?: string;
  label?: string;
  min: number;
  max: number;
  defaultValue: number;
  // Unit suffix shown next to the numeric readout, e.g. "dB".
  unit?: string;
  // Overall bounding box of the knob widget. The arc radius is derived from
  // Math.min(width, height) so the arc stays circular; extra space is used
  // by marker labels. Defaults to 100 × 100.
  width?: number;
  height?: number;
  // Whether to render the numeric readout below the arc. Defaults to true.
  showValue?: boolean;
  // Labelled tick marks around the knob arc.
  markers?: KnobMarker[];
  action: {
    serviceUuid: string;
    // configure payload sent when the knob moves.
    // String values may contain "{{value}}" which is replaced with the current
    // numeric value. Arrays are processed element-by-element the same way.
    configure: Record<string, unknown>;
  };
};

// A layout container that can appear as a named widget anywhere in the tree.
// Identical to LayoutContainer but carries `type: "layout"` so it can be
// written as a widget leaf in board JSON alongside other typed widgets.
export type LayoutWidget = LayoutContainer & { type: "layout" };

export type CanvasWidget = {
  type: "canvas";
  serviceUuid: string;
};

// The camera, as a thing on the board's surface rather than in its workings.
//
// Like `canvas` and `xy-pad` this is a service's own surface embedded in a
// panel, and for the same reason: the Camera service captures through whatever
// mounted a video element and handed it a screenshooter, so without this a
// facade view — which draws no service panels — is a board whose camera never
// starts.
export type CameraWidget = {
  type: "camera";
  serviceUuid: string;
  // Capture size in pixels. What the pipeline receives, which is not what is
  // shown here. Defaults to 320 × 200, matching the service panel.
  width?: number;
  height?: number;
  // The live preview. false still captures — the picture is simply not drawn
  // here, for a panel whose real display is further down the pipeline.
  preview?: boolean;
  // Width the preview is drawn at; its height follows the frame's proportions.
  previewWidth?: number;
  // Flips the preview left-to-right, the way a mirror does. The captured frame
  // is untouched. Defaults to true.
  mirror?: boolean;
};

export type XYPadWidget = {
  type: "xy-pad";
  serviceUuid: string;
  width?: number;
  height?: number;
};

export type LineChartWidget = {
  type: "line-chart";
  source: FacadeWidgetSource;
  // Max data points retained per symbol. Default: 200.
  maxPoints?: number;
  height?: number;
  width?: number;
  // Show % change from each symbol's first price so all lines share one Y scale.
  normalize?: boolean;
  // When set, only this symbol's data is plotted (for one-chart-per-symbol layouts).
  symbol?: string;
};

// Rows arrive from a service notification. A notification carrying an object is
// one more row, appended to what is already there — a log. A notification
// carrying an *array* is the whole table as it now stands, replacing it — which
// is what a service reporting a queue or a query result sends.
export type DataTableWidget = {
  type: "data-table";
  source: FacadeWidgetSource;
  // Items per page. Default: 50.
  pageSize?: number;
  // Max number of pages to keep in the buffer. Default: 100.
  maxPages?: number;
  // What to do when the buffer is full. Default: "drop-oldest".
  overflow?: "drop-new" | "drop-oldest";
  // Explicit ordered column list. When omitted, columns are derived from
  // incoming data. A name may be dotted ("value.subject") to read a field of a
  // nested object; the header shows its last segment.
  columns?: string[];
  // Adds a checkbox per row. What gets picked is written to facade state, so a
  // button elsewhere in the panel can act on it: { "$state": "<selectionState>" }.
  selectable?: boolean;
  // Column holding the value written to facade state for a picked row. May be
  // dotted. Default: "key".
  rowKey?: string;
  // Facade state key the picked rows are written to, as an array. Default:
  // "selection".
  selectionState?: string;
};

// A state reference used in widget props to read from facade state.
export type FacadeStateRef = { $state: string };

// Renders one child widget per item in an array — a set of controls a board
// cannot write out by hand because it does not know, at design time, how many
// there will be.
//
// Where the items come from is the widget's one real choice. A static array is
// a fixed set spelled out in the board; a facade state reference is a set some
// other widget published; a `source` is a set a *service* is reporting, read
// exactly as every display widget reads one. The last is what lets a query
// result become a grid of controls rather than a table to look at — the rows a
// service returns are laid out as widgets, in the order it returned them.
//
// "{{item}}" in template string values is replaced with the current item, and
// "{{item.field}}" with a field of it (dotted paths allowed). A value that is
// exactly one of those sentinels is substituted whole, so a number stays a
// number and an object stays an object — which is what lets an item decide a
// payload's values and not merely a label's text.
export type RepeatWidget = {
  type: "repeat";
  // Absent when `source` says where the items come from.
  items?: unknown[] | FacadeStateRef;
  // Items from what a service is saying. Read like any other widget's source,
  // so a path may name the array inside a larger notification
  // ("rows" for a query's { rows, count }). Ignored when `items` is present.
  source?: FacadeWidgetSource;
  template: LayoutItem;
  // When set, items are laid out in a CSS grid with this many columns.
  // When absent, items stack in a flex column (or row if direction is set).
  columns?: number;
  direction?: "row" | "column";
  gap?: number;
  wrap?: boolean;
  // Alternating backgrounds behind the items, so a list reads as a set of
  // separate things rather than one run of text.
  //
  // `padding` is room inside a band — without it the colour hugs the text —
  // and `radius` rounds its corners. Bands are meant to touch, so a striped
  // repeat usually sets `gap` to 0 and spaces its items with this padding.
  stripe?: RepeatStripe;
};

// The two colours of a zebra: `even` is the first row and every second one
// after it, `odd` the ones between. Either may be left out, which tints only
// the other.
//
// Translucent colours (rgba) are what a facade wants here: they tint whatever
// they are drawn on, and so hold up in a light and a dark theme alike, where a
// fixed colour can only suit one of them.
export type StripeColors = {
  even?: string;
  odd?: string;
};

export type RepeatStripe = StripeColors & {
  padding?: number;
  radius?: number;
};

// A day as a calendar: the hours down the side, one column per thing being
// booked — a court, a room, a machine.
//
// The widget owns the calendar's *geometry and appearance*: the time gutter, the
// column headings, the hour lines, and what each state looks like. The board owns
// every cell's *meaning* — what it says, whose it is, and whether it is on offer.
// That split is what keeps the rules in the one place that can enforce them: a
// query that already knows who holds what can decide each cell, and the calendar
// never has to work anything out.
//
// It is the counterpart to `repeat`, not a special case of it. A repeat is the
// answer where the items are a list and the shape of one is the board's to
// describe; a calendar is the answer where the arrangement itself carries the
// meaning — an hour is a position, and a person reads the day by looking down a
// column.
export type CalendarWidget = {
  type: "calendar";
  // The cells, from a service. One row per cell, each naming its position:
  //   column  1-based index of the column it sits in
  //   hour    the hour it starts at
  //   state   "free" | "mine" | "taken" | "blocked" — how it is drawn, and
  //           whether it can be tapped ("free" and "mine" can be)
  //   label   what it says; omitted, a sensible default for the state is used
  // Any other field travels too, and can be read by the action's payload.
  source: FacadeWidgetSource;
  // Column headings, left to right. Defaults to numbering whatever columns the
  // rows mention, which is rarely what a person wants to read.
  columns?: string[];
  // The day's extent. Defaults to the hours the rows actually mention, so a
  // query that returns the day already bounded needs neither.
  fromHour?: number;
  toHour?: number;
  // Height of one hour's row, in pixels. Default 34.
  rowHeight?: number;
  // Alternating backgrounds behind the hours, the way a wide table is ruled:
  // what a person does with three columns of cells is read *across* one hour,
  // and a band is what keeps that line from drifting into the next.
  //
  // It runs the width of the row, and a free hour goes transparent so the band
  // reaches across it rather than stopping at every cell. The states that are
  // filled — taken, and yours — keep the colours that say so.
  stripe?: StripeColors;
  // The field every row carries naming the day being drawn, shown above the
  // grid. Default "day"; set to "" for a calendar that should not caption itself.
  dayField?: string;
  // What a tap sends, interpolated with the cell as "{{item.…}}" — the same
  // vocabulary a repeat's template uses.
  action?: FacadeWidgetAction;
  actions?: WidgetAction[];
  // Asks before acting, interpolated with the cell. An empty result asks
  // nothing, which is how a cell that is merely being looked at stays silent.
  confirm?: string;
};

// A set of audio files played as one sitting — the widget for a board whose
// output is something a person listens to rather than looks at.
//
// A list of addresses is not yet listening. A browser opening one file plays
// that file and stops, and the person is back at a listing choosing the next
// one; what makes a run of separate recordings into a programme is that the
// next one starts by itself. That is this widget's whole subject: it holds one
// audio element, points it at a track, and moves to the next when that track
// ends.
//
// The tracks come from a service, read like every other display widget's
// `source`, so what a board already publishes as a list — a query's rows, a
// storage listing — is what it plays. `url` is an item template in the same
// vocabulary a `repeat` uses ("{{item.base}}/{{item.path}}"), because the
// address of a track is usually assembled from an item rather than stored in
// it.
//
// Tracks are identified by their address, not their position, so a list that
// arrives again — a poll, a refresh, one new episode at the front — does not
// interrupt what is playing. A track that is still in the list keeps playing
// from where it is; only a track that has gone away stops.
//
// Playback starts on a tap, always. Browsers refuse to start audio that no one
// asked for, and `autoplay` here only says to begin as soon as the first list
// arrives *after* a person has pressed play once — a board reloaded in the
// background stays silent, which is the behaviour a listener wants anyway.
export type AudioPlayerWidget = {
  type: "audio-player";
  // The tracks, as an array. A path may name the array inside a larger
  // notification ("episodes" for { episodes, count }).
  source: FacadeWidgetSource;
  // Each track's address, interpolated with the item. A bare "{{item.url}}"
  // where the item already carries one; a joined template where it does not.
  url: string;
  // What a track is called in the list and in the now-playing line.
  // Default: the address's last segment without its extension.
  title?: string;
  // A second, quieter line under the title — a date, a source, a duration.
  subtitle?: string;
  // Start by itself when a track the widget has not seen before arrives, once
  // the person has played something here at least once in this session — the
  // difference between a library and a station. Reaching the end of the list
  // is still an end. Default false.
  autoplay?: boolean;
  // Move to the next track when one ends — and past one that will not play at
  // all, since a volume holds whatever it holds. Default true; without it this
  // is a player with a list, not a programme.
  continuous?: boolean;
  // Return to the first track after the last. Default false.
  loop?: boolean;
  // The tracks, as a list under the player, with the playing one marked and
  // any of them tappable. Default true.
  showList?: boolean;
  // How tall that list may grow before it scrolls, in pixels. Default 220.
  listMaxHeight?: number;
  // What to say when the source has given nothing yet.
  placeholder?: string;
};

export type FacadeWidget =
  | MessageListWidget
  | TextInputWidget
  | JsonInputWidget
  | StatusIndicatorWidget
  | TextWidget
  | ButtonWidget
  | QrCodeWidget
  | FilePickWidget
  | KnobWidget
  | LevelMeterWidget
  | BipolarMeterWidget
  | LineChartWidget
  | LayoutWidget
  | CanvasWidget
  | CameraWidget
  | XYPadWidget
  | DataTableWidget
  | RepeatWidget
  | AudioPlayerWidget
  | CalendarWidget;

// ---------------------------------------------------------------------------
// Layout tree — panels declare their structure declaratively.
// A LayoutItem is either a container node (has `items`) or a widget leaf.
// ---------------------------------------------------------------------------

export type LayoutContainer = {
  direction: "row" | "column";
  // Folds the container behind a header row, for a group that is occasionally
  // needed and the rest of the time in the way — the headers and query
  // parameters of a request most people send without either. What it costs a
  // panel when closed is one row, which is what lets the controls below it
  // stay on screen.
  collapsible?: boolean;
  // The header's text. A fold needs one: a row that does not say what it hides
  // is worse than the space it saved.
  title?: string;
  // Open on first render. Closed by default, which is the point of folding.
  open?: boolean;
  // A live count beside the title, so a closed group still says how much is in
  // it — the difference between "no headers" and "two headers you forgot".
  // Reads a service notification the way a widget's `source` does, or a facade
  // state key; an object or array reports its size, anything else its text.
  summary?: FacadeWidgetSource | FacadeStateRef;
  gap?: number;
  // Room inside the container, on both axes.
  padding?: number;
  // Room on one axis only, overriding `padding` there — so a column can have
  // room at its sides without pushing its first widget down from the panel's
  // title, and a row can be inset from the edge without gaining height.
  //
  // Two fields rather than four sides: the pair is what a layout actually asks
  // for, and a board that needs one side alone is describing a gap between two
  // things, which is what `gap` is for.
  paddingX?: number;
  paddingY?: number;
  align?: string; // alignItems
  justify?: string; // justifyContent
  wrap?: boolean;
  grow?: boolean;
  // Expands the container to fill available space (flex: 1) without clipping
  // overflow. Use this to give justify/align room to work, e.g. vertically
  // centering content inside a panel.
  fill?: boolean;
  // CSS width of this node (e.g. "80%" or 200). Siblings shrink to fit, so
  // ratios like 75% / 25% hold even with a gap between them. Combine with a
  // parent's align:"center" to centre a width-constrained row/column.
  width?: number | string;
  items: LayoutItem[];
};

// Widgets may carry an optional grow flag to fill remaining space in their
// parent. To size a widget to a proportion of its parent, wrap it in a
// container that carries `width` (widget-internal `width`, e.g. on knob or
// text-input, controls the widget's own drawing, not its layout slot).
export type LayoutLeaf = FacadeWidget & { grow?: boolean };

export type LayoutItem = LayoutContainer | LayoutLeaf;

export type FacadePanel = {
  id: string;
  title?: string;
  layout: LayoutItem;
  // The share of the row this panel asks for, beside the panels it shares one
  // with: "70%", or the bare number that means the same thing. Which column
  // matters is usually known when the board is written — a reading list beside
  // the articles is the smaller half of that pair on anybody's screen — and an
  // even split is otherwise what every facade opens as.
  //
  // A share rather than a size, because the row is divided between the panels
  // in it and the window is whatever size it is. It is a starting point: the
  // divider still moves, and what a person leaves it at is what that board
  // opens as next time. Ignored where the panels do not share a row at all —
  // the mobile view stacks them.
  width?: number | string;
};

// One face of a facade: the panels a person sees while it is chosen.
//
// A board's controls are rarely all for the same person, or for the same
// moment. Subscribing to a feed is done once and reading it is done every day;
// a poll's dates are put up by whoever called the meeting and answered by
// everybody else. A panel that belongs to the other job is not neutral — it is
// in the way, and it invites a change nobody meant to make.
//
// A tab is a *view over the panels a facade already has*, not a second place to
// hold them: a panel is declared once, in `panels`, and a tab says when it is
// looked at. So a facade gains tabs by adding a list of names, and everything
// that addresses a panel — the editor, the column widths, a widget's service —
// goes on working.
export type FacadeTab = {
  id: string;
  title: string;
  // The panels this tab shows, by panel id, left to right. A panel no tab names
  // is not hidden: it sits above the tab bar, on screen whichever tab is
  // chosen, which is what a board means by a status strip it always wants read.
  panels: string[];
};

// Something worth interrupting somebody about, raised as a toast rather than
// drawn into the panel.
//
// A panel that reserves a row for a problem it usually does not have spends
// layout on nothing, and on the one occasion there is something to say, says it
// wherever that row happens to sit — which may be past the bottom of the
// screen. A notice costs no layout at all, appears where the app's other
// notifications appear, and leaves on its own.
//
// It reads a service the way a widget's `source` does, and fires whenever the
// value it names arrives with something in it. That is the whole condition, and
// it is what makes the declaration honest: a service reporting `error: ""` on a
// good run says nothing, and the same service reporting a reason says it.
//
// Unlike a widget it never seeds from the service's current state. A widget
// showing what a service already holds is showing the truth; a toast for a
// failure that happened before this board was open is news about nothing.
export type FacadeNotice = {
  source: FacadeWidgetSource;
  // How it is shown. "error" by default — what a board has to say unprompted is
  // usually that something did not work.
  tone?: "info" | "success" | "error";
  // What it says, with "{{value}}" standing for the value that raised it.
  // Absent, the value itself is the message.
  message?: string;
};

export type FacadeDescriptor = {
  // "single" renders one panel full-size; "columns" renders panels side-by-side.
  layout: "single" | "columns";
  panels: FacadePanel[];
  // Initial values for the shared facade state store.
  state?: Record<string, unknown>;
  // Actions fired once when the facade mounts (and when the board changes).
  // { "$state": "key" } references in configure payloads resolve against the
  // current facade state, so services can be seeded from state on load.
  init?: WidgetAction[];
  // Groups the panels into faces, one of which is on screen at a time. Absent,
  // every panel is on screen at once, which is what a facade with one audience
  // means.
  tabs?: FacadeTab[];
  // The tab a board opens on, by id. Defaults to the first one.
  //
  // Not remembered between visits: which face a board opens as is the board's
  // to say, and the answer is the tab everybody uses rather than the one
  // somebody was last in when they set the thing up.
  defaultTab?: string;
  // Toasts raised from what services say, instead of rows kept free for them.
  notices?: FacadeNotice[];
};
