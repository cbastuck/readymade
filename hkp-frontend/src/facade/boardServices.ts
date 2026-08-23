import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { ServiceInstance } from "hkp-frontend/src/types";

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

export function findService(
  boardContext: BoardContextState,
  uuid: string,
): ServiceInstance | null {
  // Browser runtime scopes expose findServiceInstance
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
    if (!runtime?.url || !scope) {
      continue;
    }
    return {
      uuid,
      app: (scope as any).app,
      state: desc.state,
      configure: async (config: any) => {
        // The remote runtime authenticates this the same way it authenticates
        // every other call, and resolves the runtime inside the token holder's
        // own namespace — so the token is what makes the runtime reachable at
        // all, not just an authorisation check.
        const idToken = (scope as any).authenticatedUser?.idToken;
        await fetch(
          `${runtime.url}/runtimes/${runtime.id}/services/${uuid}`,
          {
            method: "POST",
            body: JSON.stringify(config),
            headers: {
              "content-type": "application/json",
              ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
            },
          },
        );
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
  for (const scope of Object.values(boardContext.scopes)) {
    const svc = (scope as any).findServiceInstance?.(uuid)?.[0];
    if (svc) {
      // false: begin *at* this service; the default advances past it.
      void (scope as any).next?.(svc, payload, null, false);
      return;
    }
  }

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
