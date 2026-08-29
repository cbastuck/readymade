/**
 * The board as a scene: every service on every runtime, at every nesting depth,
 * placed on a lattice that can be looked at from any angle.
 *
 * The board's own structure supplies the axes, so nothing here is laid out by
 * force or by hand:
 *
 *   X — the runtime chain. Runtimes are called in order, left to right.
 *   Y — position within a pipeline. Services are called top to bottom.
 *   Z — nesting depth, away from the camera. A sub-pipeline sits behind the
 *       service hosting it.
 *
 * A pipeline is walked depth-first, so a nested service is placed directly
 * below the one that hosts it and one layer further back. The result reads as
 * the board does — a column per runtime — with the levels that a flat list can
 * only show one at a time laid out in depth.
 */
import { RuntimeDescriptor, ServiceDescriptor } from "hkp-frontend/src/types";

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

export type OverviewEdge = {
  from: string;
  to: string;
  kind: OverviewEdgeKind;
};

export type OverviewNode = {
  uuid: string;
  label: string;
  serviceId: string;
  runtimeId: string;
  /** 0 for a service sitting directly on a runtime. */
  depth: number;
  /** Position within its own pipeline. */
  index: number;
  /** The service hosting this one, if any. */
  parent?: string;
  /** Hosts from the outermost in — what has to be opened to reach this node. */
  ancestry: string[];
  bypassed: boolean;
  x: number;
  y: number;
  z: number;
};

export type OverviewRuntime = {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  z: number;
};

export type OverviewScene = {
  runtimes: OverviewRuntime[];
  nodes: OverviewNode[];
  edges: OverviewEdge[];
  byUuid: Map<string, OverviewNode>;
  /** Middle of everything placed, so a camera can start pointed at the board. */
  center: { x: number; y: number; z: number };
  /** Half the diagonal of what was placed, for framing the initial view. */
  radius: number;
};

/** The sub-pipeline a service hosts, or an empty list if it hosts none. */
function childrenOf(service: any): Array<any> {
  const pipeline = service?.state?.pipeline;
  return Array.isArray(pipeline) ? pipeline : [];
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

  runtimes.forEach((runtime, column) => {
    const x = column * COLUMN_SPACING;
    runtimeNodes.push({
      id: runtime.id,
      label: runtime.name || runtime.id,
      type: String(runtime.type ?? ""),
      x,
      y: -ROW_SPACING,
      z: 0,
    });

    // One cursor for the whole column: depth-first placement puts a nested
    // service on the row after its host, rather than restarting at the top of
    // the column and overlapping what is already there.
    let row = 0;

    const walk = (
      pipeline: Array<any>,
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

        const children = childrenOf(service);
        const node: OverviewNode = {
          uuid,
          label: labelOf(service, service?.serviceId ?? uuid),
          serviceId: service?.serviceId ?? "",
          runtimeId: runtime.id,
          depth,
          index,
          parent,
          ancestry,
          bypassed: !!(service?.bypass ?? service?.state?.bypass),
          x,
          y: row * ROW_SPACING,
          z: depth * LAYER_SPACING,
        };
        row += 1;
        nodes.push(node);
        placed.push(uuid);

        if (placed.length > 1) {
          edges.push({
            from: placed[placed.length - 2],
            to: uuid,
            kind: "sequence",
          });
        }

        if (children.length > 0) {
          const inner = walk(children, depth + 1, [...ancestry, uuid], uuid);
          if (inner.length > 0) {
            edges.push({ from: uuid, to: inner[0], kind: "contains" });
          }
        }
      });

      return placed;
    };

    walk(services[runtime.id] ?? [], 0, [], undefined);
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
      edges.push({ from: previousTail.uuid, to: top[0].uuid, kind: "handoff" });
    }
    previousTail = top[top.length - 1];
  }

  const byUuid = new Map(nodes.map((n) => [n.uuid, n]));

  const placed = [
    ...nodes.map((n) => ({ x: n.x, y: n.y, z: n.z })),
    ...runtimeNodes.map((r) => ({ x: r.x, y: r.y, z: r.z })),
  ];
  if (placed.length === 0) {
    return {
      runtimes: runtimeNodes,
      nodes,
      edges,
      byUuid,
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

  return { runtimes: runtimeNodes, nodes, edges, byUuid, center, radius };
}
