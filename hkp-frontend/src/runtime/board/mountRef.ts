/**
 * References to runtime-assigned endpoints, in one place.
 *
 * A service that needs to be reachable from outside (an HTTP endpoint, a PeerJS
 * signalling server) no longer binds a port it chose. The runtime assigns it a
 * path on the shared server and publishes the resulting URL in the service's
 * state. The address is therefore not knowable at board-design time, so a board
 * names the *service* and resolves the address when it connects.
 *
 * The reference format is `"<runtimeId>/<serviceUuid>"`.
 */

import { deepClone } from "./traversal";

export type MountRef = {
  runtimeId: string;
  serviceUuid: string;
};

/** Endpoint parts a client needs to dial a mount. */
export type MountEndpoint = {
  host: string;
  port: number;
  path: string;
  secure: boolean;
};

/**
 * Parses a `"<runtimeId>/<serviceUuid>"` reference. Returns null for anything
 * that is not a well-formed reference, so callers can treat a blank or legacy
 * value as "no reference configured".
 */
export function parseMountRef(
  value: string | null | undefined,
): MountRef | null {
  if (!value) {
    return null;
  }
  const slash = value.indexOf("/");
  if (slash <= 0 || slash === value.length - 1) {
    return null;
  }
  return {
    runtimeId: value.slice(0, slash),
    serviceUuid: value.slice(slash + 1),
  };
}

export function formatMountRef(ref: MountRef): string {
  return `${ref.runtimeId}/${ref.serviceUuid}`;
}

/**
 * Splits a published mount URL into the parts a client is configured with.
 * Returns null when the URL is absent or unparseable — which is the normal
 * state before the runtime that owns the mount has finished loading, not an
 * error.
 */
export function parseMountEndpoint(
  url: string | null | undefined,
): MountEndpoint | null {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    const secure = parsed.protocol === "https:" || parsed.protocol === "wss:";
    const port = parsed.port ? Number(parsed.port) : secure ? 443 : 80;
    return {
      host: parsed.hostname,
      port,
      // A trailing slash would make PeerJS build "//peerjs"; keep it bare.
      path: parsed.pathname.replace(/\/$/, ""),
      secure,
    };
  } catch {
    return null;
  }
}

/**
 * Resolves a mount reference to its endpoint by reading the published `url`
 * from the referenced service's state.
 *
 * `readServiceState` is absent on hosts that cannot see across runtimes, and
 * returns nothing while the owning runtime is still loading — boards restore
 * their runtimes concurrently, so a browser service can reach this point before
 * the remote runtime has published anything. Both cases resolve to null and are
 * expected to be retried rather than reported as failures.
 */
export function resolveMountEndpoint(
  ref: MountRef | null,
  readServiceState:
    | ((runtimeId: string, serviceUuid: string) => unknown)
    | undefined,
): MountEndpoint | null {
  if (!ref || !readServiceState) {
    return null;
  }
  const state = readServiceState(ref.runtimeId, ref.serviceUuid) as
    | { url?: unknown }
    | null
    | undefined;
  return typeof state?.url === "string"
    ? parseMountEndpoint(state.url)
    : null;
}

/**
 * Service state fields holding a mount reference, and how to write the resolved
 * endpoint back as concrete connection settings for that service's client.
 * Add an entry here when a service gains its own reference field.
 */
const MOUNT_REF_FIELDS: Record<
  string,
  (endpoint: MountEndpoint) => Record<string, unknown>
> = {
  peerMount: (endpoint) => ({
    peerHost: endpoint.host,
    peerPort: endpoint.port,
    peerPath: endpoint.path,
    peerSecure: endpoint.secure,
  }),
};

/**
 * Rewrites every mount reference in a board into concrete connection settings.
 *
 * A reference is meaningful only inside the board that also holds the runtime
 * it names. Boards exported to another device are not that board: a partner
 * board drops runtimes the partner cannot reach, and a shared single-runtime
 * board carries just one. Handing those a reference leaves the receiver waiting
 * for an endpoint that will never appear, so exports resolve it here — the same
 * contract template variables already follow.
 *
 * References that cannot be resolved are left untouched rather than blanked, so
 * a board exported before its runtime came up still describes what it wanted.
 */
export function resolveMountRefsInBoard<T>(
  board: T,
  readServiceState: (runtimeId: string, serviceUuid: string) => unknown,
): T {
  const resolved = deepClone(board);

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== "object") {
      return;
    }

    const obj = node as Record<string, unknown>;
    for (const [field, toSettings] of Object.entries(MOUNT_REF_FIELDS)) {
      const raw = obj[field];
      const ref = parseMountRef(typeof raw === "string" ? raw : null);
      if (!ref) {
        continue;
      }
      const endpoint = resolveMountEndpoint(ref, readServiceState);
      if (!endpoint) {
        continue;
      }
      Object.assign(obj, toSettings(endpoint));
      delete obj[field];
    }

    // Services nest inside sub-service pipelines, so keep descending.
    for (const value of Object.values(obj)) {
      walk(value);
    }
  };

  walk(resolved);
  return resolved;
}
