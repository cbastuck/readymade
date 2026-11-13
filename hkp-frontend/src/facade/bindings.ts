import {
  FacadeDescriptor,
  FacadeWidget,
  LayoutItem,
  WidgetAction,
} from "./types";

/**
 * What a widget is bound to, and which way: what it **sends to** — a service it
 * configures, asks to process, hands a file, or a facade state key it writes —
 * and what it **shows from** — a service it reads, or a state key it reads.
 *
 * Named from the widget's side. The flow inspector's Input and Output are the
 * service's side, and the two point opposite ways: what a button sends is a
 * service's input.
 *
 * Bindings are found by the shape of a property rather than from a list of the
 * widgets that have one: a `source`, an `action`, an entry in an action list,
 * the second reference a widget keeps beside its main one
 * (`progressServiceUuid`, `thresholdKnobServiceUuid`) and a `{ "$state": … }`
 * read are spelled the same way wherever they occur, so a widget added later is
 * covered without this being edited. The one exception is a widget that embeds
 * a service's own surface (`canvas`, `camera`, `detect`, `xy-pad`): it names a
 * bare `serviceUuid`, and whether that surface sends or shows is a fact about
 * the widget, kept in `EMBEDDED_SURFACES`.
 *
 * Two things are deliberately not walked. A container's children answer for
 * themselves, because each is rendered by a node of its own, and a repeat's
 * template binds nothing until an item has been substituted into it. And a
 * payload — what a `configure` or a `process` carries — is the target service's
 * business: a uuid inside one is a value being sent somewhere, not an address
 * this facade dials, and may well name something on another board. A
 * `{ "$state": … }` inside one is still read, though: it is how the value of one
 * widget reaches another's payload.
 */
export type ServiceBinding =
  | { role: "sends"; service: string; verb: "configure"; keys: string[] }
  | { role: "sends"; service: string; verb: "process" }
  // A file-pick hands the picked file to the service's own `send`.
  | { role: "sends"; service: string; verb: "send" }
  // A surface that captures and hands on what it captured: the camera.
  | { role: "sends"; service: string; verb: "surface" }
  | { role: "shows"; service: string; path?: string; surface?: true };

export type StateBinding =
  | { role: "sends"; state: string }
  | { role: "shows"; state: string };

export type Binding = ServiceBinding | StateBinding;

export function isServiceBinding(binding: Binding): binding is ServiceBinding {
  return "service" in binding;
}

export function isStateBinding(binding: Binding): binding is StateBinding {
  return "state" in binding;
}

type SurfaceBindings = (service: string) => Binding[];

/**
 * How each widget's bindings are found. Nearly every widget is read by the
 * shape of its properties. The others embed a service's surface in the panel
 * under a bare `serviceUuid`, and say here what that surface does: a camera
 * captures frames that go down the pipeline; a canvas and a detect show what
 * their service drew or saw; an XY pad shows its service's surface and
 * configures it with the position.
 *
 * Exhaustive over the widget types so that a new widget has to say which it
 * is, and so that the tests can hold a case for every one.
 */
const DISCOVERY: Record<FacadeWidget["type"], "by-shape" | SurfaceBindings> = {
  "message-list": "by-shape",
  "text-input": "by-shape",
  "json-input": "by-shape",
  editor: "by-shape",
  "status-indicator": "by-shape",
  text: "by-shape",
  button: "by-shape",
  "qr-code": "by-shape",
  "file-pick": "by-shape",
  knob: "by-shape",
  "level-meter": "by-shape",
  "bipolar-meter": "by-shape",
  "line-chart": "by-shape",
  layout: "by-shape",
  "data-table": "by-shape",
  repeat: "by-shape",
  "audio-player": "by-shape",
  calendar: "by-shape",
  swimlane: "by-shape",
  canvas: (service) => [{ role: "shows", service, surface: true }],
  detect: (service) => [{ role: "shows", service, surface: true }],
  camera: (service) => [{ role: "sends", service, verb: "surface" }],
  "xy-pad": (service) => [
    { role: "sends", service, verb: "configure", keys: ["position", "eventType"] },
    { role: "shows", service, surface: true },
  ],
};

/** Every widget type a facade knows. */
export const WIDGET_TYPES = Object.keys(DISCOVERY) as FacadeWidget["type"][];

function surfaceOf(type: string | undefined): SurfaceBindings | undefined {
  const discovery =
    type && type in DISCOVERY
      ? DISCOVERY[type as FacadeWidget["type"]]
      : undefined;
  return typeof discovery === "function" ? discovery : undefined;
}

// What a widget's `selectable` writes to when it names no `selectionState`;
// the data table and the swimlane agree on it.
const DEFAULT_SELECTION_STATE = "selection";

const ACTION_TYPES = new Set<WidgetAction["type"]>([
  "configure",
  "set-state",
  "process",
  "board",
  "confirm",
  "prompt",
  "show-panel",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stateKeyOf(value: unknown): string | undefined {
  return isObject(value) && typeof value["$state"] === "string"
    ? value["$state"]
    : undefined;
}

function isAction(value: Record<string, unknown>): value is WidgetAction {
  return (
    typeof value.type === "string" &&
    ACTION_TYPES.has(value.type as WidgetAction["type"])
  );
}

function isReference(name: string): boolean {
  return name.endsWith("ServiceUuid");
}

/** Only the state a value reads — nothing in it is an address. */
function collectStateReads(value: unknown, out: Binding[]): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectStateReads(entry, out));
    return;
  }
  if (!isObject(value)) {
    return;
  }
  const key = stateKeyOf(value);
  if (key !== undefined) {
    out.push({ role: "shows", state: key });
    return;
  }
  Object.values(value).forEach((entry) => collectStateReads(entry, out));
}

function collectAction(action: WidgetAction, out: Binding[]): void {
  switch (action.type) {
    case "configure":
      out.push({
        role: "sends",
        service: action.serviceUuid,
        verb: "configure",
        keys: Object.keys(action.configure ?? {}),
      });
      collectStateReads(action.configure, out);
      return;
    case "process":
      out.push({ role: "sends", service: action.serviceUuid, verb: "process" });
      collectStateReads(action.payload, out);
      return;
    case "set-state":
      out.push({ role: "sends", state: action.key });
      collectStateReads(action.value, out);
      return;
    case "confirm":
      collectStateReads(action.question, out);
      return;
    case "prompt":
      collectStateReads(action.question, out);
      collectStateReads(action.defaultValue, out);
      return;
    // A board action and a show-panel reach no service and no state.
    case "board":
    case "show-panel":
      return;
  }
}

function collect(value: unknown, name: string, out: Binding[]): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => collect(entry, name, out));
    return;
  }
  if (!isObject(value)) {
    return;
  }

  const stateKey = stateKeyOf(value);
  if (stateKey !== undefined) {
    out.push({ role: "shows", state: stateKey });
    return;
  }

  if (isAction(value)) {
    collectAction(value, out);
    return;
  }

  const service =
    typeof value.serviceUuid === "string" ? value.serviceUuid : undefined;
  if (service !== undefined) {
    if (isObject(value.configure)) {
      // The shorthand `action`: a configure without a `type`.
      out.push({
        role: "sends",
        service,
        verb: "configure",
        keys: Object.keys(value.configure),
      });
      collectStateReads(value.configure, out);
      return;
    }
    if (name === "action") {
      // An action that only names its service — the file-pick's.
      out.push({ role: "sends", service, verb: "send" });
      return;
    }
    // Shaped like a source: a `source`, an `indicator.source`, an `except`'s
    // source, a container's `summary`.
    out.push(
      typeof value.path === "string"
        ? { role: "shows", service, path: value.path }
        : { role: "shows", service },
    );
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      if (isReference(key)) {
        out.push({ role: "shows", service: entry });
      }
      continue;
    }
    collect(entry, key, out);
  }
}

function dedupe(bindings: Binding[]): Binding[] {
  const seen = new Set<string>();
  return bindings.filter((binding) => {
    const key = JSON.stringify(binding);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Everything one layout node binds, in the order it is written: sends before
 * shows where one property does both, otherwise as the properties come.
 *
 * Asked of a repeat item after its template was interpolated with the item —
 * the repeat itself binds only where its items come from.
 */
export function widgetBindings(item: LayoutItem): Binding[] {
  const out: Binding[] = [];
  const node = item as Record<string, unknown>;
  const type = typeof node.type === "string" ? node.type : undefined;

  const surface = surfaceOf(type);
  if (typeof node.serviceUuid === "string") {
    // A widget not in the table still names a service; until it says which
    // way, it is taken to show it.
    out.push(
      ...(surface
        ? surface(node.serviceUuid)
        : [{ role: "shows" as const, service: node.serviceUuid }]),
    );
  }

  if (node.selectable === true) {
    out.push({
      role: "sends",
      state:
        typeof node.selectionState === "string"
          ? node.selectionState
          : DEFAULT_SELECTION_STATE,
    });
  }

  for (const [key, entry] of Object.entries(node)) {
    if (key === "serviceUuid" || key === "template") {
      continue;
    }
    if (key === "items") {
      // A container's children are nodes of their own, and a repeat's literal
      // items are data; only a repeat reading its items from state binds here.
      const itemsKey = stateKeyOf(entry);
      if (itemsKey !== undefined) {
        out.push({ role: "shows", state: itemsKey });
      }
      continue;
    }
    if (typeof entry === "string") {
      if (isReference(key)) {
        out.push({ role: "shows", service: entry });
      }
      continue;
    }
    collect(entry, key, out);
  }

  return dedupe(out);
}

/** The services among a node's bindings, each once. */
export function bindingServices(bindings: Binding[]): string[] {
  return [
    ...new Set(bindings.filter(isServiceBinding).map((b) => b.service)),
  ];
}

// ---------------------------------------------------------------------------
// The facade as a whole
// ---------------------------------------------------------------------------

/**
 * Where a binding was written: a node of a panel's layout, or one of the
 * facade's own lists.
 *
 * A node is addressed by its panel and its position in the layout, because a
 * widget need not have an id. A position inside a repeat's template is marked
 * with "template": what is written there binds once per item, and a key the
 * template reads is the same key whichever item reads it.
 */
export type BindingSite =
  | {
      kind: "widget";
      panel: string;
      path: (number | "template")[];
      type?: string;
      // What a person would call it: the widget's label or title, where it has one.
      label?: string;
    }
  | { kind: "init"; index: number }
  | { kind: "notice"; index: number };

/** A stable key for a site, the same on every render of the same facade. */
export function siteKey(site: BindingSite): string {
  if (site.kind === "widget") {
    return `${site.panel}/${site.path.join(".")}`;
  }
  return `${site.kind}/${site.index}`;
}

export type StateKeyBindings = {
  // Whether the facade's `state` gives the key a value before anybody writes it.
  seeded: boolean;
  writers: BindingSite[];
  readers: BindingSite[];
};

export type FacadeBindings = {
  // What runs when the facade opens, one entry per init action that binds.
  init: { site: BindingSite; bindings: Binding[] }[];
  // Each notice's source.
  notices: { site: BindingSite; bindings: Binding[] }[];
  // Every state key the facade mentions, with who writes it and who reads it.
  state: Record<string, StateKeyBindings>;
};

function labelOf(item: LayoutItem): string | undefined {
  const node = item as Record<string, unknown>;
  for (const field of ["label", "title"]) {
    if (typeof node[field] === "string" && node[field]) {
      return node[field] as string;
    }
  }
  return undefined;
}

function isContainerNode(item: LayoutItem): boolean {
  const node = item as Record<string, unknown>;
  return Array.isArray(node.items) && node.type !== "repeat";
}

/**
 * Every node of a panel's layout with its site, including the nodes of a
 * repeat's template, which bind once per item.
 */
export function walkLayout(
  panel: string,
  item: LayoutItem,
  visit: (item: LayoutItem, site: Extract<BindingSite, { kind: "widget" }>) => void,
  path: (number | "template")[] = [],
): void {
  const node = item as Record<string, unknown>;
  visit(item, {
    kind: "widget",
    panel,
    path,
    type: typeof node.type === "string" ? node.type : undefined,
    label: labelOf(item),
  });
  if (isContainerNode(item)) {
    (node.items as LayoutItem[]).forEach((child, i) =>
      walkLayout(panel, child, visit, [...path, i]),
    );
    return;
  }
  if (node.type === "repeat" && isObject(node.template)) {
    walkLayout(panel, node.template as LayoutItem, visit, [...path, "template"]);
  }
}

/**
 * The bindings that belong to the facade rather than to any one widget — its
 * init actions and notices — and an index of every facade state key to the
 * places that write and read it.
 */
export function facadeBindings(facade: FacadeDescriptor): FacadeBindings {
  const state: Record<string, StateKeyBindings> = {};
  const entry = (key: string): StateKeyBindings =>
    (state[key] ??= { seeded: false, writers: [], readers: [] });

  for (const key of Object.keys(facade.state ?? {})) {
    entry(key).seeded = true;
  }

  const index = (site: BindingSite, bindings: Binding[]) => {
    for (const binding of bindings) {
      if (!isStateBinding(binding)) {
        continue;
      }
      const list =
        binding.role === "sends"
          ? entry(binding.state).writers
          : entry(binding.state).readers;
      if (!list.some((known) => siteKey(known) === siteKey(site))) {
        list.push(site);
      }
    }
  };

  for (const panel of facade.panels ?? []) {
    walkLayout(panel.id, panel.layout, (item, site) => {
      index(site, widgetBindings(item));
    });
  }

  const init = (facade.init ?? []).map((action, i) => {
    const bindings: Binding[] = [];
    collectAction(action, bindings);
    const site: BindingSite = { kind: "init", index: i };
    index(site, bindings);
    return { site, bindings: dedupe(bindings) };
  });

  const notices = (facade.notices ?? []).map((notice, i) => {
    const bindings: Binding[] = [];
    collect(notice.source, "source", bindings);
    return { site: { kind: "notice", index: i } as BindingSite, bindings };
  });

  return {
    init: init.filter(({ bindings }) => bindings.length > 0),
    notices,
    state,
  };
}
