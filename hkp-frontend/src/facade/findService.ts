import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { ServiceInstance } from "hkp-frontend/src/types";

/**
 * Locate a service instance by uuid across all runtime scopes.
 *
 * Browser runtime scopes expose `findServiceInstance` directly.
 * REST runtime services don't have a local instance — we return a lightweight
 * proxy whose `configure()` posts the config over HTTP to the remote runtime.
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
        await fetch(
          `${runtime.url}/runtimes/${runtime.id}/services/${uuid}`,
          {
            method: "POST",
            body: JSON.stringify(config),
            headers: { "content-type": "application/json" },
          },
        );
      },
    } as unknown as ServiceInstance;
  }
  return null;
}

export function resolvePath(obj: any, path: string): any {
  return path.split(".").reduce((cur, key) => cur?.[key], obj);
}

export function extractText(notification: any, path?: string): string | null {
  if (notification == null) {
    return null;
  }
  const val = path ? resolvePath(notification, path) : notification;
  if (val == null) {
    return null;
  }
  if (typeof val === "string") {
    return val;
  }
  if (typeof val === "number" || typeof val === "boolean") {
    return String(val);
  }
  return JSON.stringify(val);
}
