/**
 * Generic board traversal.
 *
 * A board descriptor is the raw JSON a board is (de)serialised as: a runtimes
 * list plus a `services` map, where any service may nest its own sub-service
 * pipeline. Services that need to find or transform particular nodes should
 * build on the helpers here rather than re-implementing their own walk. That
 * keeps the traversal logic in one well-tested place, and — since the visitor
 * is generic — a change to the board shape (or the set of services affected by
 * such a change) has a single, greppable point of truth.
 *
 * The board is loosely typed at this layer (it is arbitrary descriptor JSON),
 * so these helpers operate structurally on `any` and narrow as they go.
 */

export type BoardNode = any;

/**
 * Invokes `visit` for every service node reachable from `root` — the top-level
 * services map and any nested sub-service pipelines — regardless of how the
 * board is structured. A service node is any object carrying a string
 * `serviceId`.
 */
export function forEachServiceNode(
  root: BoardNode,
  visit: (node: any) => void,
): void {
  if (Array.isArray(root)) {
    for (const item of root) {
      forEachServiceNode(item, visit);
    }
    return;
  }
  if (root && typeof root === "object") {
    if (typeof root.serviceId === "string") {
      visit(root);
    }
    for (const key of Object.keys(root)) {
      forEachServiceNode(root[key], visit);
    }
  }
}

/**
 * Collects every service node whose `serviceId` matches, anywhere in the board.
 */
export function collectServicesById(
  root: BoardNode,
  serviceId: string,
): any[] {
  const out: any[] = [];
  forEachServiceNode(root, (node) => {
    if (node.serviceId === serviceId) {
      out.push(node);
    }
  });
  return out;
}

/**
 * Structural deep clone of a board (or any structured-cloneable value), so a
 * transform can operate on a copy and never mutate the descriptor emitted by an
 * upstream service.
 */
export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Applies `visit` to every string in a structure, rebuilding it as it goes.
 *
 * Shared by the substitution passes a board goes through on load — secret
 * references and unit parameters — so that both agree on what counts as a
 * value worth rewriting.
 *
 * Only plain objects and arrays are entered. A board's state can carry things
 * that are not JSON — a Uint8Array, a class instance a service put there — and
 * rebuilding one of those field by field would quietly change what it is.
 */
export function mapStrings<T>(value: T, visit: (text: string) => string): T {
  return walkStrings(value, visit) as T;
}

function walkStrings(value: unknown, visit: (text: string) => string): unknown {
  if (typeof value === "string") {
    return visit(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => walkStrings(item, visit));
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    out[key] = walkStrings(entry, visit);
  }
  return out;
}
