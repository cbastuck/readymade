/**
 * Runtime-assigned endpoints, in one place.
 *
 * A service that needs to be reachable from outside (an HTTP endpoint, a PeerJS
 * signalling server) no longer binds a port it chose. The runtime assigns it a
 * path on the shared server and publishes the resulting address. The address is
 * therefore not knowable at board-design time, so a board names the *service*
 * and resolves the address when it connects.
 *
 * Both sides use one reserved state field:
 *
 *   __hkpMount says where a mount is.
 *
 * A service that *owns* a mount publishes its address there, as an absolute
 * `http(s)://` URL. A service that *consumes* one points at the owner there,
 * as `hkp-mount://<runtimeId>/<serviceUuid>`, which resolves to the owner's
 * value. The two forms are told apart by scheme.
 *
 * The `__hkp` prefix marks a property whose meaning is defined outside the
 * service holding it: generic board machinery reads and rewrites it, so the
 * name is reserved and services must not use it for anything else.
 */

import { deepClone } from "./traversal";

/** State field holding a mount address, on both the owner and the consumer. */
export const MOUNT_FIELD = "__hkpMount";

/**
 * Scheme marking a value as a reference to a mount-owning service rather than
 * an address. A scheme of its own, because `<runtimeId>/<serviceUuid>` on its
 * own is indistinguishable from a relative URL — and the hosts these boards run
 * on resolve relative URLs against a base that differs between builds (`hkp://`
 * in a packaged app, `http://` in dev). This is deliberately not a path under
 * the existing `hkp://` scheme: that one addresses servable resources, and a
 * reference is not one.
 */
export const MOUNT_SCHEME = "hkp-mount://";

export type MountRef = {
  runtimeId: string;
  serviceUuid: string;
};

/** Address parts a client needs to dial a mount. */
export type MountEndpoint = {
  host: string;
  port: number;
  path: string;
  secure: boolean;
};

/**
 * Parses a `hkp-mount://<runtimeId>/<serviceUuid>` reference. Returns null for
 * anything that is not one — an address, a blank, a legacy value — so callers
 * can treat "not a reference" as "nothing to resolve".
 *
 * Split by hand rather than through `URL`, which would subject the runtime id
 * to host syntax; both parts here are opaque board identifiers.
 */
export function parseMountRef(
  value: string | null | undefined,
): MountRef | null {
  if (!value || !value.startsWith(MOUNT_SCHEME)) {
    return null;
  }
  const target = value.slice(MOUNT_SCHEME.length);
  const slash = target.indexOf("/");
  if (slash <= 0 || slash === target.length - 1) {
    return null;
  }
  return {
    runtimeId: target.slice(0, slash),
    serviceUuid: target.slice(slash + 1),
  };
}

export function formatMountRef(ref: MountRef): string {
  return `${MOUNT_SCHEME}${ref.runtimeId}/${ref.serviceUuid}`;
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
 * Resolves whatever a consuming service holds in `__hkpMount` to an address:
 * a reference by reading the owner's published `__hkpMount`, an address by
 * parsing it directly. Consumers call this and handle null; they never inspect
 * which form they were given.
 *
 * `readServiceState` is absent on hosts that cannot see across runtimes, and
 * returns nothing while the owning runtime is still loading — boards restore
 * their runtimes concurrently, so a browser service can reach this point before
 * the remote runtime has published anything. Both cases resolve to null and are
 * expected to be retried rather than reported as failures.
 */
export function resolveMount(
  value: string | null | undefined,
  readServiceState:
    | ((runtimeId: string, serviceUuid: string) => unknown)
    | undefined,
): MountEndpoint | null {
  return parseMountEndpoint(resolveMountUrl(value, readServiceState));
}

/**
 * The address form of a `__hkpMount` value: the owner's published URL for a
 * reference, the value itself when it is already an address. Null while a
 * reference has nothing to resolve to yet.
 */
export function resolveMountUrl(
  value: string | null | undefined,
  readServiceState:
    | ((runtimeId: string, serviceUuid: string) => unknown)
    | undefined,
): string | null {
  const ref = parseMountRef(value);
  if (!ref) {
    return value ?? null;
  }
  if (!readServiceState) {
    return null;
  }
  const state = readServiceState(ref.runtimeId, ref.serviceUuid) as
    | Record<string, unknown>
    | null
    | undefined;
  const published = state?.[MOUNT_FIELD];
  return typeof published === "string" && published ? published : null;
}

/**
 * Rewrites every mount reference in a board into the address it currently
 * resolves to.
 *
 * A reference is meaningful only inside the board that also holds the runtime
 * it names. Boards exported to another device are not that board: a partner
 * board drops runtimes the partner cannot reach, and a shared single-runtime
 * board carries just one. Handing those a reference leaves the receiver waiting
 * for an endpoint that will never appear, so exports resolve it here — the same
 * contract template variables already follow.
 *
 * Because both forms live in the same field, this is an in-place substitution:
 * the receiving service reads the field exactly as it always does, and needs to
 * know nothing about export. References that cannot be resolved are left
 * untouched rather than blanked, so a board exported before its runtime came up
 * still describes what it wanted.
 */
export function resolveMountsInBoard<T>(
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
    const raw = obj[MOUNT_FIELD];
    if (typeof raw === "string" && parseMountRef(raw)) {
      const url = resolveMountUrl(raw, readServiceState);
      if (url) {
        obj[MOUNT_FIELD] = url;
      }
    }

    // Services nest inside sub-service pipelines, so keep descending.
    for (const value of Object.values(obj)) {
      walk(value);
    }
  };

  walk(resolved);
  return resolved;
}
