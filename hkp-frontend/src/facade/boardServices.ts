import { BoardContextState } from "hkp-frontend/src/BoardContext";
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
  }
  // REST runtime services don't have a local instance — proxy configure() over HTTP
  for (const [runtimeId, svcs] of Object.entries(boardContext.services)) {
    const desc = svcs.find((s) => s.uuid === uuid);
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
      state: desc.state,
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
  }

  // No scope claimed the uuid: the service lives on a remote runtime.
  for (const [runtimeId, svcs] of Object.entries(boardContext.services)) {
    if (!svcs.find((s) => s.uuid === uuid)) {
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
