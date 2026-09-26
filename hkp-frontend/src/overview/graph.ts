/**
 * The board as a scene: every service on every runtime, at every nesting depth,
 * placed on a lattice that can be looked at from any angle.
 *
 * The board's own structure supplies the axes, so nothing here is laid out by
 * force or by hand:
 *
 *   X — the runtime chain. Runtimes are called in order, left to right.
 *   Y — position within a pipeline. Services are called top to bottom, and a
 *       runtime starts on the row the one before it handed over from, so the
 *       board reads as one flow stepping down and across.
 *   Z — nesting depth, away from the camera. A sub-pipeline sits behind the
 *       service hosting it.
 *
 * A pipeline is walked depth-first. A nested service starts level with the one
 * that hosts it, one layer further back, so what a host contains reads as a
 * step into the board rather than a step down it; the rows below are taken by
 * the rest of that pipeline, and what follows the host resumes under them. The
 * result reads as the board does — a column per runtime — with the levels that
 * a flat list can only show one at a time laid out in depth.
 */
import { RuntimeDescriptor, ServiceDescriptor } from "hkp-frontend/src/types";
import { joinAddress } from "hkp-frontend/src/runtime/board/address";

/** Distance between runtime columns. */
export const COLUMN_SPACING = 460;
/** Distance between consecutive services in a pipeline. */
export const ROW_SPACING = 120;
/** Distance between nesting levels. */
export const LAYER_SPACING = 300;

export type OverviewEdgeKind =
  /** One service to the next within the same pipeline. */
  | "sequence"
  /** The end of one runtime to the start of the next. */
  | "handoff"
  /** A service to the pipeline it hosts. */
  | "contains";

/** Edges name the nodes they join by key; see OverviewNode.key. */
export type OverviewEdge = {
  from: string;
  to: string;
  kind: OverviewEdgeKind;
};

export type OverviewNode = {
  /**
   * What tells this node from every other on the board: its address, the path
   * through the services hosting it (`groove.patterns.straight.kick`). A uuid
   * is only unique within its own pipeline — two copies of one block hold
   * services of the same names — so it cannot be what a node is found by.
   * Also the address a scope reports this service's activity under.
   */
  key: string;
  /** What the service is called where it lives. */
  uuid: string;
  label: string;
  serviceId: string;
  runtimeId: string;
  /** 0 for a service sitting directly on a runtime. */
  depth: number;
  /** Position within its own pipeline. */
  index: number;
  /** The key of the service hosting this one, if any. */
  parent?: string;
  /**
   * Which of that host's pipelines it sits in — `onRequest`, a track's name —
   * where the host holds more than one and the name says which. Absent for a
   * service sitting directly on a runtime.
   */
  pipeline?: string;
  /** Hosts from the outermost in — what has to be opened to reach this node. */
  ancestry: string[];
  bypassed: boolean;
  /**
   * What the service reports it is configured with, for reading rather than
   * for drawing — the scene places a node from the fields above and never
   * looks in here.
   */
  state?: unknown;
  x: number;
  y: number;
  z: number;
};

export type OverviewRuntime = {
  id: string;
  label: string;
  type: string;
  /** What the board paints this runtime with, where it says so. */
  color?: string;
  x: number;
  y: number;
  z: number;
};

export type OverviewScene = {
  runtimes: OverviewRuntime[];
  nodes: OverviewNode[];
  edges: OverviewEdge[];
  byKey: Map<string, OverviewNode>;
  /** Middle of everything placed, so a camera can start pointed at the board. */
  center: { x: number; y: number; z: number };
  /** Half the diagonal of what was placed, for framing the initial view. */
  radius: number;
};

/** One pipeline a service holds, under the name that service files it by. */
type NestedPipeline = { name: string; entries: Array<any> };

function isEntry(value: unknown): boolean {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as { serviceId?: unknown }).serviceId === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Every pipeline a service holds, in the order it reports them.
 *
 * The search is over the shape of an entry — a `serviceId` — rather than over
 * the field a particular container keeps its pipeline in, for the reason
 * `runtime/board/address.ts` gives: a scope calls it `pipeline`, an endpoint
 * has `onProcess` and `onRequest`, Tracks has one per track and a `reduce`
 * besides. Teaching this the fields would mean teaching it again for the next
 * container, and until then drawing that container as though it held nothing.
 *
 * Each one is kept apart rather than run together, because they are separate
 * runs: what follows a service in `onProcess` is not what follows it in
 * `onRequest`, and a list of both would say it was. The name is the field they
 * were found under, or what the thing holding them calls itself where it has a
 * name of its own — a track's, rather than the `pipeline` inside it. A list of
 * things that hold pipelines and name none of them — a Switch's cases — is
 * numbered, and anything still sharing a name after that is numbered too:
 * what a pipeline is called is also what tells it from its host's others, so
 * two of them called the same thing would be drawn as one.
 */
function pipelinesOf(service: any): NestedPipeline[] {
  const found: NestedPipeline[] = [];

  const visit = (value: unknown, label: string, named: boolean) => {
    if (Array.isArray(value)) {
      const entries = value.filter(isEntry);
      if (entries.length > 0) {
        // What a service holds is its own; this is as deep as the search goes.
        found.push({ name: label, entries });
        return;
      }
      value.forEach((item, order) => {
        const own =
          isRecord(item) && typeof item.name === "string" && item.name
            ? item.name
            : null;
        // What an item is called is the best name for what is inside it, so
        // from here on a field name does not replace it: the `pipeline` in a
        // track is that track's, not a pipeline among the host's others.
        visit(item, own ?? (named ? label : `${label} ${order + 1}`), true);
      });
      return;
    }
    if (!isRecord(value)) {
      return;
    }
    for (const [key, nested] of Object.entries(value)) {
      if (nested && typeof nested === "object") {
        visit(nested, named ? label : key, named);
      }
    }
  };

  visit(service?.state, "pipeline", false);

  // Whatever the shapes above left, no two of a host's pipelines answer to the
  // same name: that name is what tells them apart on screen and what groups
  // the services standing in them.
  const taken = new Map<string, number>();
  return found.map((held) => {
    const seen = (taken.get(held.name) ?? 0) + 1;
    taken.set(held.name, seen);
    return seen > 1 ? { ...held, name: `${held.name} ${seen}` } : held;
  });
}

/** A node's key, from the uuids of the services hosting it and its own. */
export function keyOf(ancestry: string[], uuid: string): string {
  return [...ancestry, uuid].reduce((path, part) => joinAddress(path, part), "");
}

function labelOf(service: any, fallback: string): string {
  return (
    service?.serviceName ||
    service?.state?.serviceName ||
    service?.__descriptor?.serviceName ||
    fallback
  );
}

/**
 * A nested entry names itself `instanceId`, a top-level one `uuid`. Both are
 * the id the runtime reports that service's activity under.
 */
function uuidOf(service: any): string | undefined {
  return service?.uuid ?? service?.instanceId;
}

export function buildScene(
  runtimes: Array<RuntimeDescriptor>,
  services: { [runtimeId: string]: Array<ServiceDescriptor> },
): OverviewScene {
  const nodes: OverviewNode[] = [];
  const edges: OverviewEdge[] = [];
  const runtimeNodes: OverviewRuntime[] = [];

  // Where the next runtime's first service goes: the row its input arrives on,
  // which is the row the runtime before it hands over from. Starting every
  // column at the top instead would leave the handoff running the height of
  // the board — the longest line drawn, for the one relationship that needs
  // saying least, since the columns are already in the order they are called.
  let columnStart = 0;

  runtimes.forEach((runtime, column) => {
    const x = column * COLUMN_SPACING;
    runtimeNodes.push({
      id: runtime.id,
      label: runtime.name || runtime.id,
      type: String(runtime.type ?? ""),
      color: runtime.state?.color,
      x,
      y: (columnStart - 1) * ROW_SPACING,
      z: 0,
    });

    // One cursor for the whole column: depth-first placement puts a nested
    // service on the row after its host, rather than restarting at the top of
    // the column and overlapping what is already there.
    let row = columnStart;
    // The row the chain leaves this runtime on, which is where the next one
    // picks it up. A nested pipeline can be placed below it, so it is the last
    // service the runtime itself holds rather than the cursor's final value.
    let handoffRow = columnStart;

    const walk = (
      pipeline: Array<any>,
      name: string | undefined,
      depth: number,
      ancestry: string[],
      parent: string | undefined,
    ): string[] => {
      const placed: string[] = [];

      pipeline.forEach((service, index) => {
        const uuid = uuidOf(service);
        if (!uuid) {
          return;
        }

        const nested = pipelinesOf(service);
        const hostRow = row;
        const key = keyOf(ancestry, uuid);
        const node: OverviewNode = {
          key,
          uuid,
          label: labelOf(service, service?.serviceId ?? uuid),
          serviceId: service?.serviceId ?? "",
          runtimeId: runtime.id,
          depth,
          index,
          parent,
          pipeline: name,
          ancestry,
          bypassed: !!(service?.bypass ?? service?.state?.bypass),
          state: service?.state,
          x,
          y: hostRow * ROW_SPACING,
          z: depth * LAYER_SPACING,
        };
        if (depth === 0) {
          handoffRow = hostRow;
        }
        row += 1;
        nodes.push(node);
        placed.push(key);

        if (placed.length > 1) {
          edges.push({
            from: placed[placed.length - 2],
            to: key,
            kind: "sequence",
          });
        }

        nested.forEach((held, order) => {
          // The first is level with its host rather than under it: the two are
          // a layer apart, so sharing the row costs nothing and says that
          // stepping into a service is not the same move as going on to the
          // next one. A second pipeline of the same host is a layer apart from
          // nothing, so it takes the rows under the first.
          if (order === 0) {
            row = hostRow;
          }
          const inner = walk(
            held.entries,
            held.name,
            depth + 1,
            [...ancestry, uuid],
            key,
          );
          if (inner.length > 0) {
            edges.push({ from: key, to: inner[0], kind: "contains" });
          }
        });
      });

      return placed;
    };

    walk(services[runtime.id] ?? [], undefined, 0, [], undefined);
    columnStart = handoffRow;
  });

  // Runtimes are chained, so what leaves the last service of one arrives at the
  // first service of the next. Runtimes holding no services are skipped rather
  // than breaking the chain visually.
  const topLevelOf = (runtimeId: string) =>
    nodes.filter((n) => n.runtimeId === runtimeId && n.depth === 0);
  let previousTail: OverviewNode | undefined;
  for (const runtime of runtimes) {
    const top = topLevelOf(runtime.id);
    if (top.length === 0) {
      continue;
    }
    if (previousTail) {
      edges.push({ from: previousTail.key, to: top[0].key, kind: "handoff" });
    }
    previousTail = top[top.length - 1];
  }

  const byKey = new Map(nodes.map((n) => [n.key, n]));

  const placed = [
    ...nodes.map((n) => ({ x: n.x, y: n.y, z: n.z })),
    ...runtimeNodes.map((r) => ({ x: r.x, y: r.y, z: r.z })),
  ];
  if (placed.length === 0) {
    return {
      runtimes: runtimeNodes,
      nodes,
      edges,
      byKey,
      center: { x: 0, y: 0, z: 0 },
      radius: COLUMN_SPACING,
    };
  }

  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of placed) {
    min.x = Math.min(min.x, p.x);
    min.y = Math.min(min.y, p.y);
    min.z = Math.min(min.z, p.z);
    max.x = Math.max(max.x, p.x);
    max.y = Math.max(max.y, p.y);
    max.z = Math.max(max.z, p.z);
  }

  const center = {
    x: (min.x + max.x) / 2,
    y: (min.y + max.y) / 2,
    z: (min.z + max.z) / 2,
  };
  const radius = Math.max(
    Math.hypot(max.x - min.x, max.y - min.y, max.z - min.z) / 2,
    ROW_SPACING,
  );

  return { runtimes: runtimeNodes, nodes, edges, byKey, center, radius };
}
