import { BoardContextState } from "hkp-frontend/src/BoardContext";
import {
  addressRoot,
  isScopedAddress,
  splitAddress,
} from "hkp-frontend/src/runtime/board/address";
import {
  RuntimeApi,
  RuntimeClassType,
  ServiceInstance,
  toCanonicalRuntimeClassType,
} from "hkp-frontend/src/types";

/**
 * How a facade reaches a service on the board.
 *
 * Two verbs, and the whole file is about keeping them apart: `findService`
 * hands back something whose `configure()` says what a service *is*, and
 * `processService` says do this now. They are apart at the far end too — a
 * runtime that let configure start work would make every settings edit a
 * potential side effect — so they stay apart here.
 *
 * Both cross the same gap. A browser service is an object in this process and
 * is called directly; a service on a REST runtime has no local instance, so
 * each verb becomes a request to the runtime holding it. A widget is written
 * against neither.
 */

/**
 * The API for a runtime's class, by the same two-step lookup the board itself
 * uses: a runtime may name its class in a board-specific spelling, which falls
 * back to the canonical one the engines register under.
 */
function runtimeApiFor(
  boardContext: BoardContextState,
  type: RuntimeClassType | undefined,
): RuntimeApi | null {
  if (!type) {
    return null;
  }
  const apis = boardContext.runtimeApis || {};
  return apis[type] || apis[toCanonicalRuntimeClassType(type)] || null;
}

/**
 * The top-level service an address starts at, and what is left of the address.
 *
 * Only a browser scope answers: its services are live objects in this process,
 * so a scope among them can be asked to walk the rest itself. On a REST
 * runtime the whole address is dialled and the runtime walks it there.
 */
function ownerOfNested(
  scope: unknown,
  address: string,
): { service: any; rest: string } | null {
  if (!isScopedAddress(address)) {
    return null;
  }
  const segments = splitAddress(address);
  const root = (scope as any).findServiceInstance?.(segments[0])?.[0];
  if (!root || typeof root.processNested !== "function") {
    return null;
  }
  return { service: root, rest: segments.slice(1).join(".") };
}

/** The live service a scoped address names inside a browser scope. */
function findNestedInScope(
  scope: unknown,
  address: string,
): ServiceInstance | null {
  const owner = ownerOfNested(scope, address);
  if (!owner || typeof owner.service.findNested !== "function") {
    return null;
  }
  return owner.service.findNested(owner.rest) ?? null;
}

export function findService(
  boardContext: BoardContextState,
  uuid: string,
): ServiceInstance | null {
  // Only browser scopes expose findServiceInstance — a browser service is a
  // live object in this process, so a hit hands back the real instance. Remote
  // runtime engines have no such function, and fall through to the proxy below.
  for (const scope of Object.values(boardContext.scopes)) {
    const svc = (scope as any).findServiceInstance?.(uuid)?.[0];
    if (svc) {
      return svc;
    }
    // A scoped address names a service inside one of this scope's own: the
    // root is what the scope lists, and the scope holding it walks the rest.
    const nested = findNestedInScope(scope, uuid);
    if (nested) {
      return nested;
    }
  }
  // REST runtime services don't have a local instance — proxy configure() over HTTP
  //
  // A scoped address is matched by its root: what a board lists is the service
  // at the top, and everything the address names after that is inside it. So
  // the root says which runtime to dial, and the whole address is what gets
  // dialled — the runtime walks the rest of it. The state a board holds is the
  // root's; a nested service's arrives when it first reports.
  const root = addressRoot(uuid);
  for (const [runtimeId, svcs] of Object.entries(boardContext.services)) {
    const desc = svcs.find((s) => s.uuid === root);
    if (!desc) {
      continue;
    }
    const runtime = boardContext.runtimes.find((rt) => rt.id === runtimeId);
    const scope = boardContext.scopes[runtimeId];
    const api = runtimeApiFor(boardContext, runtime?.type);
    if (!runtime?.url || !scope || !api) {
      continue;
    }
    return {
      uuid,
      app: (scope as any).app,
      state: root === uuid ? desc.state : undefined,
      // The runtime's own API rather than a request written here: configuring a
      // remote service is more than the POST — the secrets a configuration
      // names have to reach the runtime first, and the state it answers with is
      // what the board then holds, which is what a service's panel renders. A
      // hand-rolled fetch leaves the panel showing what the board was loaded
      // with while the runtime has moved on.
      configure: async (config: any) => {
        await api.configureService(scope, { uuid }, config);
      },
    } as unknown as ServiceInstance;
  }
  return null;
}

/**
 * Asks a service to do its job with a payload, running the pipeline from that
 * service onward — rather than from the one after it, which is what a service
 * handing work onward means.
 */
export function processService(
  boardContext: BoardContextState,
  uuid: string,
  payload: unknown,
): void {
  // Which runtime holds the service is not asked, it is discovered: only a
  // browser scope implements findServiceInstance, because only there is the
  // service a live object in this process. A hit therefore means "local", and
  // the work is a direct call. Remote runtime engines expose no such function,
  // so their services fall through to the request below.
  for (const scope of Object.values(boardContext.scopes)) {
    const svc = (scope as any).findServiceInstance?.(uuid)?.[0];
    if (svc) {
      // false: begin *at* this service; the default advances past it.
      void (scope as any).next?.(svc, payload, null, false);
      return;
    }
    // A scoped address is entered through the scope holding it, so that what
    // runs is what is written inside it rather than whatever happens to
    // follow the scope in the runtime's own list.
    const owner = ownerOfNested(scope, uuid);
    if (owner) {
      void owner.service.processNested(owner.rest, payload);
      return;
    }
  }

  // No scope claimed the uuid: the service lives on a remote runtime. Matched
  // by the address's root for the same reason findService matches by it.
  const root = addressRoot(uuid);
  for (const [runtimeId, svcs] of Object.entries(boardContext.services)) {
    if (!svcs.find((s) => s.uuid === root)) {
      continue;
    }
    const runtime = boardContext.runtimes.find((rt) => rt.id === runtimeId);
    const scope = boardContext.scopes[runtimeId];
    if (!runtime?.url || !scope) {
      continue;
    }
    const idToken = (scope as any).authenticatedUser?.idToken;
    void fetch(
      `${runtime.url}/runtimes/${runtime.id}/services/${uuid}/process`,
      {
        method: "POST",
        body: JSON.stringify(payload ?? {}),
        headers: {
          "content-type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
      },
    );
    return;
  }
}

/**
 * The board as one unit's view may see it.
 *
 * A facade addresses a service by uuid alone, and `findService` answers with
 * the first match across the whole board. That is ambiguous the moment two
 * runtimes hold the same uuid — which units make ordinary, since a unit's
 * uuids are scoped by its own runtimes and nothing stops two units using the
 * same ones.
 *
 * Narrowing the context a view renders against fixes it for every widget at
 * once, without a single renderer having to know that units exist: a unit's
 * facade searches its own runtimes and finds its own services. An empty
 * `runtimeIds` means a view over the whole board — the composition's own
 * facade, or a board that was never assembled from units — and is left alone.
 */
export function narrowBoardContext(
  boardContext: BoardContextState,
  runtimeIds: string[],
): BoardContextState {
  if (!runtimeIds.length) {
    return boardContext;
  }
  const wanted = new Set(runtimeIds);
  const pick = <T,>(map: { [runtimeId: string]: T }): { [id: string]: T } =>
    Object.fromEntries(
      Object.entries(map).filter(([runtimeId]) => wanted.has(runtimeId)),
    );

  return {
    ...boardContext,
    runtimes: boardContext.runtimes.filter((runtime) => wanted.has(runtime.id)),
    services: pick(boardContext.services),
    scopes: pick(boardContext.scopes),
    registry: pick(boardContext.registry),
  };
}
