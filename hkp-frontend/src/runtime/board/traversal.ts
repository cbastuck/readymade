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
