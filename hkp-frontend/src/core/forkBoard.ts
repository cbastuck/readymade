import { BoardDescriptor } from "../types";
import { MOUNT_FIELD, formatMountRef, parseMountRef } from "../runtime/board/mount";

/**
 * Copying a board so the copy is a board of its own.
 *
 * A board's runtime ids and service uuids are not decoration: a runtime server
 * namespaces runtimes by id, so two boards sharing an id are two boards fighting
 * over one runtime. Copying a deployed board without changing them would give
 * you an editor whose changes land on the deployed board — which is the whole
 * reason a fork exists rather than a plain copy.
 *
 * So every id is renamed, and everything that *references* an id is renamed
 * with it. References live in three places:
 *
 * - the structure itself — `runtimes[].id`, the keys of `services`, each
 *   service's `uuid`, and the `instanceId` of every service nested in a
 *   pipeline;
 * - fields that name a service or a runtime: `targetServiceUuid` (Configurator,
 *   ProcessRouter), `targetRuntime`, and the facade's `serviceUuid` widgets;
 * - `__hkpMount`, when it holds a `hkp-mount://<runtimeId>/<serviceUuid>`
 *   reference rather than an address.
 *
 * Rewriting is driven by *field name*, not by value: an id like `node` or
 * `mon-1` is an ordinary string that could appear anywhere in a board, and
 * replacing every occurrence of it would corrupt data that merely reads like an
 * id. The cost is that a service inventing its own way to name another service
 * is not carried across — see KNOWN_REFERENCE_FIELDS, which is where such a
 * field would be added.
 */

/** Fields whose value names a service instance. */
const SERVICE_ID_FIELDS = new Set([
  "uuid",
  "instanceId",
  "targetServiceUuid",
  "serviceUuid",
]);

/** Fields whose value names a runtime. */
const RUNTIME_ID_FIELDS = new Set(["targetRuntime", "runtimeId"]);

export const KNOWN_REFERENCE_FIELDS = {
  service: [...SERVICE_ID_FIELDS],
  runtime: [...RUNTIME_ID_FIELDS],
  mount: MOUNT_FIELD,
};

type Json = unknown;

function isObject(value: Json): value is Record<string, Json> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** A short tag, so a forked id still reads as the id it came from. */
function forkToken(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Collects every service id in the document, however deeply nested. */
function collectServiceIds(value: Json, into: Set<string>): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectServiceIds(entry, into);
    }
    return;
  }
  if (!isObject(value)) {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    // A service that *is* here, rather than one being pointed at: a target
    // that names something outside this board must keep naming it.
    if ((key === "uuid" || key === "instanceId") && typeof child === "string") {
      into.add(child);
    }
    collectServiceIds(child, into);
  }
}

function rewrite(
  value: Json,
  services: Map<string, string>,
  runtimes: Map<string, string>,
): Json {
  if (Array.isArray(value)) {
    return value.map((entry) => rewrite(entry, services, runtimes));
  }
  if (!isObject(value)) {
    return value;
  }
  const next: Record<string, Json> = {};
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string") {
      if (SERVICE_ID_FIELDS.has(key)) {
        next[key] = services.get(child) ?? child;
        continue;
      }
      if (RUNTIME_ID_FIELDS.has(key)) {
        next[key] = runtimes.get(child) ?? child;
        continue;
      }
      if (key === MOUNT_FIELD) {
        const ref = parseMountRef(child);
        // An address rather than a reference is left alone: it may name
        // something outside this board entirely, and a fork has no basis for
        // deciding it meant the copy.
        next[key] = ref
          ? formatMountRef({
              runtimeId: runtimes.get(ref.runtimeId) ?? ref.runtimeId,
              serviceUuid: services.get(ref.serviceUuid) ?? ref.serviceUuid,
            })
          : child;
        continue;
      }
    }
    next[key] = rewrite(child, services, runtimes);
  }
  return next;
}

export type ForkedBoard = {
  board: BoardDescriptor;
  /** old id → new id, for both runtimes and services. Useful to report or test. */
  renamed: { runtimes: Record<string, string>; services: Record<string, string> };
};

/**
 * Forks a board: a copy with fresh ids, and every reference to them updated.
 *
 * The original is not touched. The copy is a plain board document — it is not
 * deployed, not running, and not connected to whatever the original is doing.
 */
export function forkBoard(
  board: BoardDescriptor,
  options: { name?: string; token?: string } = {},
): ForkedBoard {
  const token = options.token ?? forkToken();
  const rename = (id: string) => `${id}-${token}`;

  const runtimes = new Map<string, string>();
  for (const runtime of board.runtimes ?? []) {
    runtimes.set(runtime.id, rename(runtime.id));
  }
  for (const runtimeId of Object.keys(board.services ?? {})) {
    if (!runtimes.has(runtimeId)) {
      runtimes.set(runtimeId, rename(runtimeId));
    }
  }

  const serviceIds = new Set<string>();
  collectServiceIds(board.services ?? {}, serviceIds);
  const services = new Map<string, string>();
  for (const id of serviceIds) {
    services.set(id, rename(id));
  }

  const forked = rewrite(
    {
      ...board,
      runtimes: (board.runtimes ?? []).map((runtime) => ({
        ...runtime,
        id: runtimes.get(runtime.id) ?? runtime.id,
      })),
      services: Object.fromEntries(
        Object.entries(board.services ?? {}).map(([runtimeId, list]) => [
          runtimes.get(runtimeId) ?? runtimeId,
          list,
        ]),
      ),
    },
    services,
    runtimes,
  ) as BoardDescriptor;

  return {
    board: {
      ...forked,
      boardName: options.name ?? `${board.boardName ?? "Board"} fork`,
    },
    renamed: {
      runtimes: Object.fromEntries(runtimes),
      services: Object.fromEntries(services),
    },
  };
}
