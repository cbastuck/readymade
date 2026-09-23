/**
 * Addressing a service inside a scope.
 *
 * A runtime's services are a flat list, and a uuid names one of them. A service
 * holding a pipeline of its own — a SubService, an endpoint, Tracks — has
 * services inside it that the flat list does not reach. A **scoped address**
 * names one by the path through the services containing it:
 *
 *     read.kept-articles          the `kept-articles` inside the `read` scope
 *     read.list.feed-doc          two levels down
 *
 * A facade addresses a service this way wherever it addresses one at all —
 * a widget's `source`, a button's `process`, a notice — and `path` goes on
 * meaning the field inside that service's state, so the two stay separable:
 * `{ "serviceUuid": "read.kept-articles", "path": "rows" }`.
 *
 * **The separator is a dot, and that is forced rather than chosen.** A remote
 * runtime carries a service address in a URL path segment
 * (`/runtimes/:runtimeId/services/:instanceId`), which a slash would split.
 * The same constraint already picked a dot for `UNIT_SEPARATOR`.
 *
 * The runtime side of this lives in each runtime (`hkp-node/src/address.ts`);
 * what is here is what the board and its facade need to *write* an address and
 * to find the runtime one belongs to.
 */

export const ADDRESS_SEPARATOR = ".";

/** `["read", "kept-articles"]` for `"read.kept-articles"`. */
export function splitAddress(address: string): string[] {
  return address.split(ADDRESS_SEPARATOR).filter((part) => part.length > 0);
}

/** The address of `instanceId` inside `owner`. */
export function joinAddress(owner: string, instanceId: string): string {
  return owner ? `${owner}${ADDRESS_SEPARATOR}${instanceId}` : instanceId;
}

/** True where an address names something nested rather than a flat uuid. */
export function isScopedAddress(address: string): boolean {
  return splitAddress(address).length > 1;
}

/**
 * The top-level service an address starts at — the one a board lists, and so
 * the one that says which runtime the whole address belongs to.
 */
export function addressRoot(address: string): string {
  return splitAddress(address)[0] ?? address;
}

/**
 * The state of a service an address names, read out of the board document.
 *
 * The board lists only top-level services; what a scope contains lives in that
 * scope's own state, because a container reports its pipeline as part of what
 * it is. So each segment after the first is looked for among the entries
 * nested in the state reached so far.
 *
 * The search is over the shape of an entry — a `serviceId` and a name — rather
 * than over the field a particular container keeps its pipeline in. A scope
 * calls it `pipeline`, an endpoint has `onProcess` and `onRequest`, Tracks has
 * one per track; teaching this function all of them would mean teaching it
 * again for the next container, and getting it wrong silently for a board that
 * used one it had not been taught.
 */
export function resolveNestedState(
  rootState: unknown,
  segments: string[],
): unknown {
  let state: unknown = rootState;
  for (const segment of segments) {
    const entry = findEntry(state, segment);
    if (!entry) {
      return undefined;
    }
    state = entry.state;
  }
  return state;
}

type PipelineEntry = { state?: unknown };

/** The nested service entry carrying this name, however deep it is filed. */
function findEntry(state: unknown, name: string): PipelineEntry | null {
  if (Array.isArray(state)) {
    for (const item of state) {
      const found = findEntry(item, name);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (!state || typeof state !== "object") {
    return null;
  }
  const record = state as Record<string, unknown>;
  if (
    typeof record.serviceId === "string" &&
    (record.uuid === name || record.instanceId === name)
  ) {
    return record as PipelineEntry;
  }
  for (const value of Object.values(record)) {
    const found = findEntry(value, name);
    if (found) {
      return found;
    }
  }
  return null;
}
