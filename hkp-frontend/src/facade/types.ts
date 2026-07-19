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
};

export type WidgetAction = ConfigureAction | SetStateAction;

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

export type ButtonWidget = {
  type: "button";
  label: string;
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

export type DataTableWidget = {
  type: "data-table";
  source: FacadeWidgetSource;
  // Items per page. Default: 50.
  pageSize?: number;
  // Max number of pages to keep in the buffer. Default: 100.
  maxPages?: number;
  // What to do when the buffer is full. Default: "drop-oldest".
  overflow?: "drop-new" | "drop-oldest";
  // Explicit ordered column list. When omitted, columns are derived from incoming data.
  columns?: string[];
};

// A state reference used in widget props to read from facade state.
export type FacadeStateRef = { $state: string };

// Renders one child widget per item in an array. Items can be a static array
// or a facade state reference. "{{item}}" in template string values is replaced
// with each item.
export type RepeatWidget = {
  type: "repeat";
  items: unknown[] | FacadeStateRef;
  template: LayoutItem;
  // When set, items are laid out in a CSS grid with this many columns.
  // When absent, items stack in a flex column (or row if direction is set).
  columns?: number;
  direction?: "row" | "column";
  gap?: number;
  wrap?: boolean;
};

export type FacadeWidget =
  | MessageListWidget
  | TextInputWidget
  | JsonInputWidget
  | StatusIndicatorWidget
  | ButtonWidget
  | QrCodeWidget
  | FilePickWidget
  | KnobWidget
  | LevelMeterWidget
  | BipolarMeterWidget
  | LineChartWidget
  | LayoutWidget
  | CanvasWidget
  | XYPadWidget
  | DataTableWidget
  | RepeatWidget;

// ---------------------------------------------------------------------------
// Layout tree — panels declare their structure declaratively.
// A LayoutItem is either a container node (has `items`) or a widget leaf.
// ---------------------------------------------------------------------------

export type LayoutContainer = {
  direction: "row" | "column";
  gap?: number;
  padding?: number;
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
};
