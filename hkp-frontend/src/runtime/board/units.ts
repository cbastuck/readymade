/**
 * Board units: several board documents assembled into one running board.
 *
 * A unit is an ordinary board. It runs alone, unchanged. A *composition* is
 * also an ordinary board, which additionally lists the units it is made of:
 *
 *     "units": [{ "uri": "hotels", "as": "hotels" }]
 *
 * Assembling them is a **projection**, and the whole design rests on which axis
 * it renames. A runtime is already a uuid namespace, one ordered pipeline, an
 * independent lifecycle and an addressable identity — everything a unit needs.
 * So a unit contributes whole *runtimes*, never services into shared ones, and
 * the projection qualifies exactly one thing: the runtime id. Service uuids are
 * never touched, because they are already scoped by the runtime holding them.
 * Two units may both call a service `after-intake`; in different runtimes that
 * has always been legal.
 *
 * Qualification is a prefix (`hotels.intake`) and therefore invertible, which is
 * what lets a save split back into the documents it came from. A unit entry may
 * pin an id instead, for a mount whose address outside parties are configured
 * with; the projection then checks that every resulting id is still distinct,
 * since pinning re-opens the collision the prefix closes.
 *
 * Two things deliberately do *not* follow the qualified id:
 *
 * - **A unit's runtimes keep the unit's own board name.** hkp-node derives a
 *   mount address from (owner, boardName, runtimeId, mountName) and keys a
 *   database file on the board name, so letting the composition's name through
 *   would rotate a unit's public endpoints and silently move its unnamed
 *   databases to a different file. Prefixing changes the address the
 *   composition routes by; it must not change who the unit *is* to a server.
 * - **Units are never chained to each other.** Runtimes are chained — the
 *   result of one drives the next — so a unit occupies a contiguous block and
 *   the chain stops at its edge. A cross-unit chain would be a wire nobody
 *   wrote; units talk over topics.
 *
 * The vocabulary and the transform live here, pure and testable. Resolving a
 * `uri` into a document depends on where the composition itself was loaded
 * from, so that lives with the loader (`core/linkUnits`).
 */

import {
  BoardDescriptor,
  RuntimeClassType,
  RuntimeDescriptor,
  ServiceDescriptor,
} from "../../types";
import { FacadeDescriptor } from "../../facade/types";
import { collectServicesById, deepClone, mapStrings } from "./traversal";
import { MOUNT_FIELD, formatMountRef, parseMountRef } from "./mount";

/**
 * Scheme spelling out that a `uri` is meant relative to the composition's
 * origin. Rarely needed — a plain `hotels.json` already reads that way — but
 * available where a value would otherwise be ambiguous.
 */
export const UNIT_SCHEME = "hkp-unit://";

/**
 * Joins a unit's name to one of its runtime ids. A dot rather than a slash:
 * the id appears in `/runtimes/:runtimeId` paths and in the notification socket
 * key, neither of which survives a path separator.
 */
export const UNIT_SEPARATOR = ".";

/** What a unit says about itself. Present on a unit, absent on a plain board. */
export type UnitDeclaration = {
  name: string;
  /** Topics this unit consumes. */
  imports?: string[];
  /** Topics this unit publishes. */
  exports?: string[];
  /** Defaults for `{{param.x}}`, which are what "running alone" means. */
  params?: Record<string, string>;
};

/** A composition's say over one of a unit's runtimes. */
export type UnitRuntimeBinding = {
  /** Pins the id instead of prefixing it. Checked for collisions like any other. */
  id?: string;
  url?: string;
  type?: RuntimeClassType;
};

/** One entry in a composition's `units` list. */
export type UnitEntry = {
  /**
   * Where the document is, not what it is called: a file name or path relative
   * to wherever the composition itself was loaded from, or an absolute URL.
   * A relative one is exactly that — the same `hotels.json` is a sibling file,
   * a document beside the share link, or a saved board, depending on the
   * origin, which is what lets a composition move between them.
   */
  uri: string;
  /** Name this instance carries, and the prefix its runtimes get. */
  as?: string;
  params?: Record<string, string>;
  runtimes?: { [unitRuntimeId: string]: UnitRuntimeBinding };
};

/** A board document, which may declare itself a unit, a composition, or both. */
export type UnitBoard = BoardDescriptor & {
  unit?: UnitDeclaration;
  units?: UnitEntry[];
};

export type Diagnostic = {
  level: "error" | "warning";
  code: string;
  message: string;
  /** Which unit it concerns; absent for the composition itself. */
  unit?: string;
};

/** A unit as it was placed into the projection. */
export type PlacedUnit = {
  /** The name this instance carries — the prefix its runtimes get. */
  name: string;
  uri: string;
  /** The entry that placed it, kept so the projection can be recomputed. */
  entry: UnitEntry;
  /** The unit's own board name, which its runtimes keep. */
  boardName: string;
  declaration?: UnitDeclaration;
  /** The unit's own runtime id → the id it has in the projection. */
  runtimeIds: { [unitRuntimeId: string]: string };
  /** The document, as loaded, before projection. Kept for saving back. */
  source: UnitBoard;
};

/** A unit resolved to a document, ready to be placed. */
export type ResolvedUnit = {
  entry: UnitEntry;
  board: UnitBoard;
  /** Prefix for this instance — composed through nesting, so `outer.inner`. */
  name: string;
};

/** A facade and where it came from. Units are views, not one merged surface. */
export type BoardView = {
  id: string;
  title: string;
  /** The unit whose view this is; absent for the composition's own. */
  unit?: string;
  facade: FacadeDescriptor;
  /** Runtime ids the view may address. Empty means the whole board. */
  runtimeIds: string[];
};

/**
 * What linking a board produced, kept for as long as the board is loaded: the
 * units it was assembled from, so a save can split back into them, and the
 * views they contribute.
 */
export type BoardLinkage = {
  units: PlacedUnit[];
  views: BoardView[];
};

export type Projection = {
  board: BoardDescriptor;
  units: PlacedUnit[];
  views: BoardView[];
  diagnostics: Diagnostic[];
};

/** `{{param.name}}`, tolerating whitespace inside the braces. */
const PARAM_REFERENCE = /\{\{\s*param\.([A-Za-z0-9_.-]+)\s*\}\}/g;

/** How a unit writes a reference to one of its parameters. */
export function paramReference(name: string): string {
  return `{{param.${name}}}`;
}

/**
 * Substitutes a unit's parameters, anywhere in a structure.
 *
 * A reference with no value is left as it stands rather than blanked: unlike a
 * secret — where an empty string is what every service already reads as "not
 * configured" — a parameter is usually a topic, a database or a URL, and
 * emptying one produces a service that does something wrong quietly instead of
 * failing. Left intact it is visible in the board and named in a diagnostic.
 */
export function resolveParams<T>(
  value: T,
  params: Record<string, string>,
): { value: T; missing: string[] } {
  const missing = new Set<string>();
  const resolved = mapStrings(value, (text) =>
    text.replace(PARAM_REFERENCE, (whole, name: string) => {
      const param = params[name];
      if (param === undefined) {
        missing.add(name);
        return whole;
      }
      return param;
    }),
  );
  return { value: resolved, missing: [...missing] };
}

/** Every parameter a structure refers to, however deeply nested. */
export function referencedParams(value: unknown): string[] {
  const found = new Set<string>();
  mapStrings(value, (text) => {
    for (const match of text.matchAll(PARAM_REFERENCE)) {
      found.add(match[1]);
    }
    return text;
  });
  return [...found];
}

/**
 * Splits a `uri` into the two things an origin treats differently: an address
 * relative to the composition, and one that stands on its own. Returns null for
 * a blank, so a caller can treat "nothing to resolve" as such.
 */
export function parseUnitRef(
  value: string | null | undefined,
): { kind: "relative" | "absolute"; value: string } | null {
  if (!value) {
    return null;
  }
  if (value.startsWith(UNIT_SCHEME)) {
    const target = value.slice(UNIT_SCHEME.length);
    return target ? { kind: "relative", value: target } : null;
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    return { kind: "absolute", value };
  }
  return { kind: "relative", value };
}

export function formatUnitRef(uri: string): string {
  return `${UNIT_SCHEME}${uri}`;
}

/**
 * The document name inside a `uri`, without directories or a `.json` suffix.
 * A store that has no file names — saved boards are keyed by board name — has
 * this to match against.
 */
export function unitBaseName(uri: string): string {
  const last = uri.split("/").pop() ?? uri;
  return last.replace(/\.json$/i, "");
}

/** The id a unit's runtime takes in a projection, absent an explicit pin. */
export function qualifyRuntimeId(unitName: string, runtimeId: string): string {
  return `${unitName}${UNIT_SEPARATOR}${runtimeId}`;
}

/**
 * The name a unit entry gives its instance: what the composition calls it, else
 * what the unit calls itself, else the document it was read from.
 *
 * The last of those is a fallback rather than an identity — `uri` says where a
 * document is, and a file name is a poor thing to prefix runtime ids with, so
 * it is stripped to a bare base name and only used when nothing better exists.
 */
export function unitNameOf(entry: UnitEntry, board: UnitBoard): string {
  return (
    entry.as || board.unit?.name || unitBaseName(entry.uri || "") || "unit"
  );
}

/**
 * Assembles a composition and the units it resolved to into one board.
 *
 * The composition's own runtimes are left exactly as they are — unqualified is
 * what marks them as the composition's own, which is also how a save knows
 * where to put a runtime somebody added in the playground.
 */
export function projectUnits(
  root: UnitBoard,
  resolved: ResolvedUnit[],
): Projection {
  const diagnostics: Diagnostic[] = [];
  const runtimes: RuntimeDescriptor[] = [];
  const services: { [runtimeId: string]: ServiceDescriptor[] } = {};
  const units: PlacedUnit[] = [];
  const views: BoardView[] = [];

  const rootRuntimes = deepClone(root.runtimes ?? []);
  const rootServices = deepClone(root.services ?? {});
  runtimes.push(...rootRuntimes);
  for (const [runtimeId, list] of Object.entries(rootServices)) {
    services[runtimeId] = list;
  }
  if (root.facade) {
    views.push({
      id: "composition",
      title: root.boardName || "Board",
      facade: root.facade,
      runtimeIds: [],
    });
  }

  for (const unit of resolved) {
    const placed = placeUnit(unit, diagnostics);
    units.push(placed.unit);
    runtimes.push(...placed.runtimes);
    Object.assign(services, placed.services);
    if (placed.view) {
      views.push(placed.view);
    }
  }

  const board: BoardDescriptor = {
    ...root,
    runtimes,
    services,
  };

  diagnostics.push(...validateProjection(root, units));

  return { board, units, views, diagnostics };
}

function placeUnit(
  resolved: ResolvedUnit,
  diagnostics: Diagnostic[],
): {
  unit: PlacedUnit;
  runtimes: RuntimeDescriptor[];
  services: { [runtimeId: string]: ServiceDescriptor[] };
  view: BoardView | null;
} {
  const { entry, board, name } = resolved;
  const source = deepClone(board);

  const params = { ...board.unit?.params, ...entry.params };
  const { value: substituted, missing } = resolveParams(
    {
      runtimes: board.runtimes ?? [],
      services: board.services ?? {},
      facade: board.facade,
    },
    params,
  );
  for (const param of missing) {
    diagnostics.push({
      level: "warning",
      code: "unit-param-missing",
      unit: name,
      message: `Parameter "${param}" has no value; the reference is left in the board.`,
    });
  }

  // Every id first, so a mount reference can be rewritten whichever runtime it
  // points at — a unit's reference may name a runtime placed after this one.
  const runtimeIds: { [unitRuntimeId: string]: string } = {};
  for (const runtime of substituted.runtimes) {
    runtimeIds[runtime.id] = entry.runtimes?.[runtime.id]?.id
      ? entry.runtimes[runtime.id].id!
      : qualifyRuntimeId(name, runtime.id);
  }

  const runtimes = substituted.runtimes.map((runtime) => {
    const binding = entry.runtimes?.[runtime.id];
    return {
      ...runtime,
      id: runtimeIds[runtime.id],
      ...(binding?.url ? { url: binding.url } : {}),
      ...(binding?.type ? { type: binding.type } : {}),
      // Who this runtime is to a server, as against how the composition
      // addresses it. See the note on identity at the top of this file.
      boardName: board.boardName,
      unit: name,
      unitRuntimeId: runtime.id,
    } as RuntimeDescriptor;
  });

  const services: { [runtimeId: string]: ServiceDescriptor[] } = {};
  for (const [unitRuntimeId, list] of Object.entries(substituted.services)) {
    const projectedId = runtimeIds[unitRuntimeId];
    if (!projectedId) {
      diagnostics.push({
        level: "warning",
        code: "unit-orphan-services",
        unit: name,
        message: `Services are listed for runtime "${unitRuntimeId}", which the unit does not declare.`,
      });
      continue;
    }
    services[projectedId] = requalifyMounts(list, runtimeIds);
  }

  const view = substituted.facade
    ? {
        id: name,
        title: board.boardName || name,
        unit: name,
        facade: substituted.facade,
        runtimeIds: Object.values(runtimeIds),
      }
    : null;

  return {
    unit: {
      name,
      uri: entry.uri,
      entry,
      boardName: board.boardName || name,
      declaration: board.unit,
      runtimeIds,
      source,
    },
    runtimes,
    services,
    view,
  };
}

/**
 * Points a unit's mount references at the ids its runtimes ended up with.
 *
 * The same one-axis transform, applied to references rather than to the
 * runtimes themselves: `hkp-mount://intake/peer` inside the hotels unit becomes
 * `hkp-mount://hotels.intake/peer`. A reference naming a runtime this unit does
 * not have is left alone — it is either already an address, or a mistake worth
 * seeing as written.
 */
function requalifyMounts(
  services: ServiceDescriptor[],
  runtimeIds: { [unitRuntimeId: string]: string },
): ServiceDescriptor[] {
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== "object") {
      return;
    }
    const obj = node as Record<string, unknown>;
    const raw = obj[MOUNT_FIELD];
    if (typeof raw === "string") {
      const ref = parseMountRef(raw);
      const projectedId = ref && runtimeIds[ref.runtimeId];
      if (ref && projectedId) {
        obj[MOUNT_FIELD] = formatMountRef({
          runtimeId: projectedId,
          serviceUuid: ref.serviceUuid,
        });
      }
    }
    for (const value of Object.values(obj)) {
      walk(value);
    }
  };
  walk(services);
  return services;
}

/**
 * What the assembled board says about itself, checked.
 *
 * The rule on unsatisfied imports is **responsibility follows inclusion**. An
 * import declared by the document being loaded is a requirement on an
 * environment that is not there — nobody has promised to satisfy it — so it is
 * a warning, and a unit opened on its own runs. An import declared by a unit
 * the composition *included* is the composition's problem: by listing that
 * unit it asserted this set is the app, so a hole in it is an error. Nothing
 * here has to ask whether a document "is a composition"; each level answers for
 * what it includes, and the top level answers to nobody.
 */
export function validateProjection(
  root: UnitBoard,
  units: PlacedUnit[],
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Distinct runtime ids is the one invariant the whole scheme rests on, and
  // the only thing pinning can break.
  const seen = new Map<string, string>();
  for (const runtime of root.runtimes ?? []) {
    seen.set(runtime.id, root.boardName || "the composition");
  }
  for (const unit of units) {
    for (const projectedId of Object.values(unit.runtimeIds)) {
      const owner = seen.get(projectedId);
      if (owner) {
        diagnostics.push({
          level: "error",
          code: "unit-runtime-collision",
          unit: unit.name,
          message: `Runtime id "${projectedId}" is claimed by both ${owner} and ${unit.name}.`,
        });
        continue;
      }
      seen.set(projectedId, unit.name);
    }
  }

  const published = new Set<string>();
  const consumed = new Set<string>();
  for (const unit of units) {
    const topics = topicsUsedBy(unit.source.services ?? {});
    diagnostics.push(...checkDeclaredTopics(unit.name, unit.declaration, topics));
    for (const topic of topics.published) {
      published.add(topic);
    }
    for (const topic of topics.consumed) {
      consumed.add(topic);
    }
  }
  const rootTopics = topicsUsedBy(root.services ?? {});
  diagnostics.push(...checkDeclaredTopics(undefined, root.unit, rootTopics));
  for (const topic of rootTopics.published) {
    published.add(topic);
  }
  for (const topic of rootTopics.consumed) {
    consumed.add(topic);
  }

  const exported = new Set<string>([
    ...(root.unit?.exports ?? []),
    ...units.flatMap((unit) => unit.declaration?.exports ?? []),
  ]);

  for (const unit of units) {
    for (const topic of unit.declaration?.imports ?? []) {
      if (!exported.has(topic)) {
        diagnostics.push({
          level: "error",
          code: "unit-import-unsatisfied",
          unit: unit.name,
          message: `Imports "${topic}", which no unit in this board exports.`,
        });
      }
    }
  }
  for (const topic of root.unit?.imports ?? []) {
    if (!exported.has(topic)) {
      diagnostics.push({
        level: "warning",
        code: "unit-import-open",
        message: `Imports "${topic}" from outside this board; nothing here exports it.`,
      });
    }
  }

  // An export nobody takes is legal — and it fills a queue forever.
  for (const topic of exported) {
    if (!consumed.has(topic)) {
      diagnostics.push({
        level: "warning",
        code: "unit-export-unconsumed",
        message: `Nothing in this board consumes "${topic}"; messages published to it accumulate.`,
      });
    }
  }

  return diagnostics;
}

type TopicUsage = { published: Set<string>; consumed: Set<string> };

/**
 * Which topics a set of services actually uses, as opposed to declares.
 *
 * Only a literal topic is visible here. One built inside an expression is not,
 * and no static pass will see it — which is the reason for `{{param.topic}}`:
 * a parameter is substituted before this runs and stays checkable, a computed
 * string does not.
 */
export function topicsUsedBy(services: unknown): TopicUsage {
  const published = new Set<string>();
  const consumed = new Set<string>();
  for (const node of collectQueueServices(services)) {
    const topic = node?.state?.topic;
    if (typeof topic !== "string" || !topic) {
      continue;
    }
    if (node.state.mode === "publish") {
      published.add(topic);
    } else if (node.state.mode === "consume") {
      consumed.add(topic);
    }
  }
  return { published, consumed };
}

function collectQueueServices(services: unknown): any[] {
  return [
    ...collectServicesById(services, "queue"),
    ...collectServicesById(services, "hookup.to/service/queue"),
  ];
}

function checkDeclaredTopics(
  unit: string | undefined,
  declaration: UnitDeclaration | undefined,
  topics: TopicUsage,
): Diagnostic[] {
  if (!declaration) {
    return [];
  }
  const who = unit ? `${unit} ` : "";
  const diagnostics: Diagnostic[] = [];
  for (const topic of declaration.exports ?? []) {
    if (!topics.published.has(topic)) {
      diagnostics.push({
        level: "warning",
        code: "unit-export-unpublished",
        unit,
        message: `${who}declares export "${topic}" but publishes to no such topic.`,
      });
    }
  }
  for (const topic of declaration.imports ?? []) {
    if (!topics.consumed.has(topic)) {
      diagnostics.push({
        level: "warning",
        code: "unit-import-unconsumed",
        unit,
        message: `${who}declares import "${topic}" but consumes no such topic.`,
      });
    }
  }
  for (const topic of topics.published) {
    if (!(declaration.exports ?? []).includes(topic)) {
      diagnostics.push({
        level: "warning",
        code: "unit-export-undeclared",
        unit,
        message: `${who}publishes to "${topic}" without declaring it as an export.`,
      });
    }
  }
  for (const topic of topics.consumed) {
    if (!(declaration.imports ?? []).includes(topic)) {
      diagnostics.push({
        level: "warning",
        code: "unit-import-undeclared",
        unit,
        message: `${who}consumes "${topic}" without declaring it as an import.`,
      });
    }
  }
  return diagnostics;
}

export function hasErrors(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((entry) => entry.level === "error");
}

/**
 * Splitting a running board back into the documents it was assembled from.
 *
 * The inverse of `projectUnits`, and the reason qualification is a prefix
 * rather than a rewrite: a runtime says which unit it came from and what that
 * unit calls it, so where each part belongs is not a guess.
 *
 * What makes this more than a regrouping is that loading *changed* the
 * documents on the way in — parameters were substituted, a composition may have
 * overridden a url or pinned an id — and writing the running board back
 * verbatim would bake all of that into the unit, destroying the thing that made
 * it reusable. So this is a three-way merge, not a copy: the projection is
 * recomputed from the source document, and any value the board still holds
 * *unchanged* is written back as the source spelled it — `{{param.topic}}`
 * rather than the topic it resolved to. Only values that actually differ, which
 * are the ones somebody edited, are taken from the running board.
 *
 * A composition may be edited too, so its own runtimes come back as its
 * document, carrying the unit entries that produced the rest.
 */
export type UnlinkedBoards = {
  composition: UnitBoard;
  units: Array<{ unit: PlacedUnit; board: UnitBoard }>;
};

export function unlinkProjection(
  serialized: BoardDescriptor,
  units: PlacedUnit[],
): UnlinkedBoards {
  const byUnit = new Map<string, PlacedUnit>(
    units.map((unit) => [unit.name, unit]),
  );

  const ownRuntimes: RuntimeDescriptor[] = [];
  const ownServices: { [runtimeId: string]: ServiceDescriptor[] } = {};
  const unitRuntimes = new Map<string, RuntimeDescriptor[]>();
  const unitServices = new Map<string, { [id: string]: ServiceDescriptor[] }>();

  for (const runtime of serialized.runtimes ?? []) {
    const services = serialized.services?.[runtime.id] ?? [];
    const unit = runtime.unit ? byUnit.get(runtime.unit) : undefined;
    if (!unit || !runtime.unitRuntimeId) {
      // No provenance means the composition declared it — including a runtime
      // somebody added in the playground, which lands here by default.
      ownRuntimes.push(stripProvenance(runtime));
      ownServices[runtime.id] = services;
      continue;
    }
    const restoredId = runtime.unitRuntimeId;
    const runtimeList = unitRuntimes.get(unit.name) ?? [];
    runtimeList.push({ ...stripProvenance(runtime), id: restoredId });
    unitRuntimes.set(unit.name, runtimeList);

    const serviceMap = unitServices.get(unit.name) ?? {};
    serviceMap[restoredId] = services;
    unitServices.set(unit.name, serviceMap);
  }

  const composition: UnitBoard = {
    ...serialized,
    runtimes: ownRuntimes,
    services: ownServices,
    units: units.map((unit) => unit.entry),
  };

  return {
    composition,
    units: units.map((unit) => ({
      unit,
      board: mergeUnitEdits(
        unit,
        unitRuntimes.get(unit.name) ?? [],
        unitServices.get(unit.name) ?? {},
      ),
    })),
  };
}

/** Provenance is written by the projection, so it never enters a document. */
function stripProvenance(runtime: RuntimeDescriptor): RuntimeDescriptor {
  const { unit: _unit, unitRuntimeId: _id, boardName: _name, ...rest } = runtime;
  return rest as RuntimeDescriptor;
}

/**
 * The unit's document with whatever was edited in it, and nothing else.
 *
 * `expected` is what loading this unit produced; anything still equal to it was
 * not touched, and the source keeps its own wording.
 */
function mergeUnitEdits(
  unit: PlacedUnit,
  runtimes: RuntimeDescriptor[],
  services: { [runtimeId: string]: ServiceDescriptor[] },
): UnitBoard {
  const expected = expectedProjectionOf(unit);
  return {
    ...unit.source,
    runtimes: restoreEdits(
      unit.source.runtimes ?? [],
      expected.runtimes,
      runtimes,
    ) as RuntimeDescriptor[],
    services: restoreEdits(
      unit.source.services ?? {},
      expected.services,
      services,
    ) as { [runtimeId: string]: ServiceDescriptor[] },
  };
}

/**
 * What this unit looked like when it was loaded, in the unit's own coordinates:
 * parameters substituted and bindings applied, but runtime ids as the unit
 * writes them, so it lines up with the source document field for field.
 */
function expectedProjectionOf(unit: PlacedUnit): {
  runtimes: RuntimeDescriptor[];
  services: { [runtimeId: string]: ServiceDescriptor[] };
} {
  const placed = placeUnit(
    { entry: unit.entry, board: unit.source, name: unit.name },
    [],
  );
  const toOwnId = new Map(
    Object.entries(unit.runtimeIds).map(([own, projected]) => [projected, own]),
  );
  const services: { [runtimeId: string]: ServiceDescriptor[] } = {};
  for (const [projectedId, list] of Object.entries(placed.services)) {
    services[toOwnId.get(projectedId) ?? projectedId] = list;
  }
  return {
    runtimes: placed.runtimes.map((runtime) => ({
      ...stripProvenance(runtime),
      id: toOwnId.get(runtime.id) ?? runtime.id,
    })),
    services,
  };
}

/**
 * Three-way merge: `source` where nothing moved, `current` where it did.
 *
 * Compared against `expected` rather than against `source` directly, because
 * the two are allowed to differ without anybody having edited anything — that
 * difference *is* the substitution. Descends structurally so an edit to one
 * field does not drag the rest of its object over with it.
 */
export function restoreEdits(
  source: unknown,
  expected: unknown,
  current: unknown,
): unknown {
  if (deepEquals(expected, current)) {
    return source;
  }
  if (Array.isArray(source) && Array.isArray(expected) && Array.isArray(current)) {
    // Only element-wise while the shape holds: an insertion or a removal
    // renumbers everything after it, and pairing across that would rewrite
    // unrelated services.
    if (source.length === expected.length && expected.length === current.length) {
      return current.map((item, index) =>
        restoreEdits(source[index], expected[index], item),
      );
    }
    return current;
  }
  if (isPlainObject(source) && isPlainObject(expected) && isPlainObject(current)) {
    const merged: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(current)) {
      merged[key] = restoreEdits(source[key], expected[key], value);
    }
    return merged;
  }
  return current;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function deepEquals(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => deepEquals(item, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => deepEquals(a[key], b[key]))
    );
  }
  return false;
}
