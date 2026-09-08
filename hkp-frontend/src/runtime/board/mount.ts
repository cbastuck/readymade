/**
 * Runtime-assigned endpoints, in one place.
 *
 * A service that needs to be reachable from outside (an HTTP endpoint, a PeerJS
 * signalling server) no longer binds a port it chose. The runtime assigns it a
 * path on the shared server and publishes the resulting address. The address is
 * therefore not knowable at board-design time, so a board names the *service*
 * and resolves the address when it connects.
 *
 * Two things, kept apart:
 *
 *   A reference — `hkp-mount://<runtimeId>/<serviceUuid>` — is what a *person*
 *   writes, in whatever field the service already calls its target (`url`,
 *   `peerHost`, …). It says which service to reach, and it is what a board
 *   saves, shares and forks.
 *
 *   `__hkpMount` is a *runtime fact*: the address a mount currently has. An
 *   owner publishes its own there; the board's coordinator writes the resolved
 *   address onto a consumer there. Nobody authors it, and nothing about one run
 *   belongs anywhere else.
 *
 * A consumer therefore prefers `__hkpMount` when it holds an address, and falls
 * back to its own field — where a reference means "not resolved yet" rather
 * than something to dial. Keeping the two in separate fields is what lets a
 * board round-trip: resolution never overwrites what was written.
 *
 * References are found by their **scheme**, wherever they appear in a service's
 * state, rather than by living in one agreed field. A `hkp-mount://` value
 * cannot be mistaken for anything else, which is what makes that safe — the
 * same reason `{{secret.…}}` is resolved wherever it occurs.
 *
 * For boards written before the split, a reference in `__hkpMount` itself still
 * resolves: it is a string in service state like any other.
 *
 * The `__hkp` prefix marks a property whose meaning is defined outside the
 * service holding it: generic board machinery reads and rewrites it, so the
 * name is reserved and services must not use it for anything else.
 *
 * This module is the vocabulary — the field, the scheme, and how to read and
 * write both forms. Resolving one form into the other needs a view of the whole
 * board and therefore lives with the board's coordinator (`core/coordinator`).
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
 * Every mount reference a value holds, in the order they were found and without
 * duplicates.
 *
 * Walks the whole value rather than reading one field: a reference is legal in
 * whatever field a service calls its target, and services nest — a sub-service
 * pipeline carries its own services, each with their own state.
 *
 * Cheap enough to run on every board change, which is what callers do: the walk
 * is proportional to the number of values in the state, and each string costs a
 * prefix test.
 */
export function findMountRefs(value: unknown, into: string[] = []): string[] {
  if (typeof value === "string") {
    if (parseMountRef(value) && !into.includes(value)) {
      into.push(value);
    }
    return into;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      findMountRefs(item, into);
    }
    return into;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      findMountRefs(item, into);
    }
  }
  return into;
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
 * Rewrites every mount reference in a board into the address it currently
 * resolves to. Resolution itself belongs to the board's coordinator, which is
 * the only instance that can see across runtimes; this walks the document and
 * substitutes what the coordinator hands back (see `core/coordinator`).
 *
 * A reference is meaningful only inside the board that also holds the runtime
 * it names. Boards exported to another device are not that board: a partner
 * board drops runtimes the partner cannot reach, and a shared single-runtime
 * board carries just one. Handing those a reference leaves the receiver waiting
 * for an endpoint that will never appear, so exports resolve it here — the same
 * contract template variables already follow.
 *
 * Substituted in place, in whatever field held the reference: an exported board
 * is a snapshot of one run rather than the authored source, and the receiving
 * service then reads its own field exactly as it always does — it needs to know
 * nothing about export. References that cannot be resolved are left untouched
 * rather than blanked, so a board exported before its runtime came up still
 * describes what it wanted.
 */
export function substituteMountsInBoard<T>(
  board: T,
  resolveMountUrl: (value: string) => string | null,
): T {
  const resolved = deepClone(board);

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => {
        if (typeof item === "string" && parseMountRef(item)) {
          node[index] = resolveMountUrl(item) ?? item;
          return;
        }
        walk(item);
      });
      return;
    }
    if (!node || typeof node !== "object") {
      return;
    }

    const obj = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string" && parseMountRef(value)) {
        obj[key] = resolveMountUrl(value) ?? value;
        continue;
      }
      // Services nest inside sub-service pipelines, so keep descending.
      walk(value);
    }
  };

  walk(resolved);
  return resolved;
}
