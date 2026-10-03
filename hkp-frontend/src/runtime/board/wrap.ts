/**
 * Wrapping services in a sub-service: a run of a runtime's own services
 * replaced by one sub-service whose pipeline is that run.
 *
 * What runs does not change, provided two things hold, and this module is
 * where both are checked:
 *
 * - **The run is contiguous.** A runtime's order is its wiring; wrapping the
 *   first and the third service would take the second out from between them.
 * - **Nothing that names a service is cut in two by the new boundary.** A
 *   service inside a sub-service finds others by id only within that
 *   sub-service (a Configurator's `targetServiceUuid`, a ProcessRouter's), so a
 *   reference from inside the run to outside it, or from outside into it,
 *   would stop resolving. A reference with both ends in the run moves with it.
 *
 * A facade is the exception: it dials the board by scoped address, so an
 * address into the run can be rewritten to reach one level down. A use of a
 * block is not addressable from outside at all, so when the run is becoming a
 * block, a facade address into it is refused like any other reference.
 *
 * The sub-service reads its slots from the runtime (`scope.slots: "inherit"`),
 * so a Hold or a tempo reader inside the run keeps reaching the cells it
 * reached before.
 */

import { RuntimeServiceMap } from "../../types";
import { addressRoot, joinAddress } from "./address";
import { parseMountRef } from "./mount";

/**
 * The picked ids in the order the runtime holds them, or undefined when they
 * are not one unbroken run of it — or name something the runtime does not hold.
 */
export function contiguousRun(
  order: readonly string[],
  picked: Iterable<string>,
): string[] | undefined {
  const wanted = new Set(picked);
  if (wanted.size === 0) {
    return undefined;
  }
  const positions = order
    .map((id, index) => (wanted.has(id) ? index : -1))
    .filter((index) => index >= 0);
  if (positions.length !== wanted.size) {
    return undefined;
  }
  const first = positions[0];
  const last = positions[positions.length - 1];
  if (last - first + 1 !== positions.length) {
    return undefined;
  }
  return order.slice(first, last + 1);
}

/** Every id from `anchor` to `to`, inclusive, in the order the runtime holds them. */
export function runBetween(
  order: readonly string[],
  anchor: string,
  to: string,
): string[] {
  const a = order.indexOf(anchor);
  const b = order.indexOf(to);
  if (a < 0 || b < 0) {
    return b < 0 ? [] : [to];
  }
  return order.slice(Math.min(a, b), Math.max(a, b) + 1);
}

type Entry = Record<string, any>;

function entryId(entry: Entry): string | undefined {
  return typeof entry.instanceId === "string"
    ? entry.instanceId
    : typeof entry.uuid === "string"
      ? entry.uuid
      : undefined;
}

/** Every service entry in a structure, with how deep it is filed. */
function forEachEntry(
  value: unknown,
  visit: (entry: Entry, depth: number) => void,
  depth = 0,
): void {
  if (Array.isArray(value)) {
    value.forEach((item) => forEachEntry(item, visit, depth));
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  const entry = value as Entry;
  const isService = typeof entry.serviceId === "string";
  if (isService) {
    visit(entry, depth);
  }
  for (const inner of Object.values(entry)) {
    forEachEntry(inner, visit, isService ? depth + 1 : depth);
  }
}

/** Every string in a structure, with the key it is filed under. */
function forEachString(
  value: unknown,
  visit: (text: string, key: string | undefined) => void,
  key?: string,
): void {
  if (typeof value === "string") {
    visit(value, key);
  } else if (Array.isArray(value)) {
    value.forEach((item) => forEachString(item, visit, key));
  } else if (value && typeof value === "object") {
    for (const [inner, child] of Object.entries(value)) {
      forEachString(child, visit, inner);
    }
  }
}

function describe(entry: Entry): string {
  const id = entryId(entry);
  const name =
    typeof entry.serviceName === "string" ? entry.serviceName : entry.serviceId;
  return id && id !== name ? `"${name}" (${id})` : `"${name}"`;
}

export type WrapCheck = {
  /** The board's services as serialised: live state, uses expanded. */
  services: RuntimeServiceMap;
  /** Every facade on the board — its own and each unit's view. */
  facades: unknown[];
  runtimeId: string;
  /** The run being wrapped: top-level ids of `runtimeId`. */
  ids: readonly string[];
  /** Whether the run is becoming a block, whose inside nothing may address. */
  asBlock: boolean;
};

/**
 * What would stop working if the run were wrapped, each said as a sentence a
 * person can act on. Empty means the wrap keeps the board doing what it did.
 */
export function wrapProblems({
  services,
  facades,
  runtimeId,
  ids,
  asBlock,
}: WrapCheck): string[] {
  const inRun = new Set(ids);
  const problems: string[] = [];
  const intoRun = (target: string, targetRuntime: string) =>
    targetRuntime === runtimeId && inRun.has(addressRoot(target));

  for (const [ownerRuntime, list] of Object.entries(services)) {
    for (const top of list ?? []) {
      const topId = entryId(top as Entry);
      const ownerInRun =
        ownerRuntime === runtimeId && !!topId && inRun.has(topId);
      forEachEntry(top, (entry, depth) => {
        const target = entry.state?.targetServiceUuid;
        if (typeof target !== "string" || !target) {
          return;
        }
        const named = entry.state?.targetRuntime;
        const board = typeof named === "string" && named !== "";
        // Named by runtime, the target is looked up across the board, where
        // only the target's side of the boundary matters. Otherwise it is
        // looked up among the services beside the one naming it — for a
        // service filed inside another, a pipeline that moves as a whole.
        if (board) {
          if (intoRun(target, named)) {
            problems.push(
              `${describe(entry)} targets "${target}" on runtime "${named}", which would move into the sub-service.`,
            );
          }
          return;
        }
        if (depth > 0) {
          return;
        }
        const targetInRun = intoRun(target, ownerRuntime);
        if (ownerInRun && !targetInRun) {
          problems.push(
            `${describe(entry)} targets "${target}", which would be left outside the sub-service.`,
          );
        } else if (!ownerInRun && targetInRun) {
          problems.push(
            `${describe(entry)} targets "${target}", which would move into the sub-service.`,
          );
        }
      });
    }
  }

  forEachString(services, (text) => {
    const ref = parseMountRef(text);
    if (ref && intoRun(ref.serviceUuid, ref.runtimeId)) {
      problems.push(
        `"${text}" refers to the endpoint of a service that would move into the sub-service.`,
      );
    }
  });

  const addressed = new Set<string>();
  for (const facade of facades) {
    forEachString(facade, (text, key) => {
      if (key === "serviceUuid" && inRun.has(addressRoot(text))) {
        addressed.add(text);
      }
    });
  }
  if (addressed.size) {
    const elsewhere = Object.entries(services).some(
      ([id, list]) =>
        id !== runtimeId &&
        (list ?? []).some((entry: Entry) => {
          const own = entryId(entry);
          return (
            !!own &&
            [...addressed].some((address) => addressRoot(address) === own)
          );
        }),
    );
    if (asBlock) {
      for (const address of addressed) {
        problems.push(
          `The facade addresses "${address}"; inside a block nothing is addressed from outside.`,
        );
      }
    } else if (elsewhere) {
      problems.push(
        `The facade addresses ${[...addressed].map((a) => `"${a}"`).join(", ")}, and another runtime has a service by that id too, so which one it means cannot be told.`,
      );
    }
  }
  return problems;
}

/**
 * A facade with every address into the run now reaching through the wrapper:
 * `the-hit` becomes `<wrapper>.the-hit`. Nothing else in it changes.
 */
export function rewriteFacadeAddresses<T>(
  facade: T,
  ids: readonly string[],
  wrapperId: string,
): T {
  const inRun = new Set(ids);
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(walk);
    }
    if (!value || typeof value !== "object") {
      return value;
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        key === "serviceUuid" &&
        typeof inner === "string" &&
        inRun.has(addressRoot(inner))
          ? joinAddress(wrapperId, inner)
          : walk(inner),
      ]),
    );
  };
  return walk(facade) as T;
}

/** A name for a sub-service made from services with these names. */
export function nameForRun(names: readonly string[]): string {
  const kept = names.filter((name) => name.trim() !== "");
  if (kept.length === 0) {
    return "SubService";
  }
  if (kept.length <= 2) {
    return kept.join(" + ");
  }
  return `${kept[0]} + ${kept.length - 1} more`;
}
