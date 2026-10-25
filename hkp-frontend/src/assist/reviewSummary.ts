import { BoardDescriptor } from "../types";

/**
 * What a proposal asks the person to review, said before the diff.
 *
 * A board is mostly blocks — services and widgets that already run in other
 * boards — and partly what was written for this one: a statement, a schema,
 * an expression. The diff shows both as lines of JSON, which hides the one
 * thing worth knowing first: how much of the proposal is text somebody wrote
 * and somebody should read, and what it is built from. This is that, as
 * counts: the services the proposal adds or changes, the written text they
 * carry, and how many of the boards that ship use each block.
 */

/** A state field that holds something written rather than chosen. */
const AUTHORED_KEYS = new Set([
  "statement",
  "schema",
  "expression",
  "code",
  "script",
  "template",
  "prompt",
  "query",
  "html",
  "css",
]);

type ServiceEntry = {
  uuid: string;
  serviceId: string;
  serviceName?: string;
  state?: Record<string, unknown>;
};

export type AuthoredText = { service: string; field: string; lines: number };

export type ReviewSummary = {
  added: string[];
  changed: string[];
  removed: string[];
  /** Written text in the services added or changed, field by field. */
  authored: AuthoredText[];
  authoredLines: number;
  /** The blocks the proposed board uses, and how many shipped boards use each. */
  blocks: { kind: "service" | "widget"; id: string; boards: number }[];
};

/** Every service a board holds, nested pipelines included. */
function servicesOf(board: BoardDescriptor | undefined): ServiceEntry[] {
  const found: ServiceEntry[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (typeof record.serviceId === "string" && typeof record.uuid === "string") {
      found.push(record as unknown as ServiceEntry);
    }
    Object.values(record).forEach(visit);
  };
  visit((board as { services?: unknown } | undefined)?.services);
  return found;
}

/** Every widget type a board's facade draws. */
function widgetsOf(board: BoardDescriptor | undefined): Set<string> {
  const types = new Set<string>();
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (typeof record.type === "string" && !Array.isArray(record.items)) {
      types.add(record.type);
    }
    Object.values(record).forEach(visit);
  };
  visit((board as { facade?: { panels?: unknown } } | undefined)?.facade?.panels);
  return types;
}

function authoredIn(service: ServiceEntry): AuthoredText[] {
  const name = service.serviceName || service.serviceId;
  return Object.entries(service.state ?? {})
    .filter(
      ([key, value]) =>
        typeof value === "string" &&
        value.trim() !== "" &&
        (AUTHORED_KEYS.has(key) || value.includes("\n")),
    )
    .map(([field, value]) => ({
      service: name,
      field,
      lines: (value as string).split("\n").filter((line) => line.trim()).length,
    }));
}

const stable = (value: unknown) => JSON.stringify(value ?? null);

/** How many of `boards` use each service id and each widget type. */
export function blockUse(boards: BoardDescriptor[]) {
  const services = new Map<string, number>();
  const widgets = new Map<string, number>();
  for (const board of boards) {
    for (const id of new Set(servicesOf(board).map((s) => s.serviceId))) {
      services.set(id, (services.get(id) ?? 0) + 1);
    }
    for (const type of widgetsOf(board)) {
      widgets.set(type, (widgets.get(type) ?? 0) + 1);
    }
  }
  return { services, widgets };
}

export function reviewSummary(
  current: BoardDescriptor | undefined,
  proposed: BoardDescriptor,
  use: ReturnType<typeof blockUse> = { services: new Map(), widgets: new Map() },
): ReviewSummary {
  const before = new Map(servicesOf(current).map((s) => [s.uuid, s]));
  const after = servicesOf(proposed);
  const afterIds = new Set(after.map((s) => s.uuid));
  const label = (s: ServiceEntry) => s.serviceName || s.serviceId;

  const added = after.filter((s) => !before.has(s.uuid));
  const changed = after.filter(
    (s) => before.has(s.uuid) && stable(before.get(s.uuid)!.state) !== stable(s.state),
  );
  const removed = [...before.values()].filter((s) => !afterIds.has(s.uuid));
  const authored = [...added, ...changed].flatMap(authoredIn);

  const blocks = [
    ...[...new Set(after.map((s) => s.serviceId))].map((id) => ({
      kind: "service" as const,
      id,
      boards: use.services.get(id) ?? 0,
    })),
    ...[...widgetsOf(proposed)].map((id) => ({
      kind: "widget" as const,
      id,
      boards: use.widgets.get(id) ?? 0,
    })),
  ].sort((a, b) => b.boards - a.boards || a.id.localeCompare(b.id));

  return {
    added: added.map(label),
    changed: changed.map(label),
    removed: removed.map(label),
    authored,
    authoredLines: authored.reduce((sum, text) => sum + text.lines, 0),
    blocks,
  };
}
