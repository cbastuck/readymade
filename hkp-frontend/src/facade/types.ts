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
  action: FacadeWidgetAction;
};

export type StatusIndicatorWidget = {
  type: "status-indicator";
  source: FacadeWidgetSource;
  statusColors?: Record<string, string>;
};

export type ButtonWidget = {
  type: "button";
  label: string;
  action: FacadeWidgetAction;
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

export type FacadeWidget =
  | MessageListWidget
  | TextInputWidget
  | StatusIndicatorWidget
  | ButtonWidget
  | QrCodeWidget
  | FilePickWidget
  | KnobWidget
  | LevelMeterWidget
  | LayoutWidget;

// ---------------------------------------------------------------------------
// Layout tree — panels declare their structure declaratively.
// A LayoutItem is either a container node (has `items`) or a widget leaf.
// ---------------------------------------------------------------------------

export type LayoutContainer = {
  direction: "row" | "column";
  gap?: number;
  padding?: number;
  align?: string;   // alignItems
  justify?: string; // justifyContent
  wrap?: boolean;
  grow?: boolean;
  // Expands the container to fill available space (flex: 1) without clipping
  // overflow. Use this to give justify/align room to work, e.g. vertically
  // centering content inside a panel.
  fill?: boolean;
  items: LayoutItem[];
};

// Widgets may carry an optional grow flag to fill remaining space in their parent.
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
};
