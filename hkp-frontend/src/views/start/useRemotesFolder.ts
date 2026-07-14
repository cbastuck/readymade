import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { RuntimeClass } from "hkp-frontend/src/types";
import { useAppContext } from "../../AppContext";
import { FolderNode, RemotesController, RuntimeNode } from "./types";

/** Runtime as a host reports it in GET /runtimes. Only the fields the Remotes
 *  source needs are modelled; hosts may send more. */
interface RemoteRuntimePayload {
  id: string;
  name?: string;
  boardName?: string;
  services?: Array<{
    uuid: string;
    serviceId: string;
    serviceName?: string;
    state?: unknown;
  }>;
}

/** Give up on an unreachable remote quickly rather than hanging the source. */
const FETCH_TIMEOUT_MS = 4000;

function toRuntimeNode(rt: RemoteRuntimePayload, url: string): RuntimeNode {
  return {
    type: "runtime",
    id: rt.id,
    name: rt.name || rt.id,
    remoteUrl: url,
    boardName: rt.boardName || undefined,
    services: (rt.services ?? []).map((svc) => ({
      uuid: svc.uuid,
      serviceId: svc.serviceId,
      serviceName: svc.serviceName || svc.serviceId,
      state: svc.state,
    })),
  };
}

/** GET {url}/runtimes and map to RuntimeNodes. Read-only: never POSTs, so it
 *  never recreates a runtime (which hkp-rt would do for a re-POSTed id). */
async function listRemoteRuntimes(
  url: string,
  idToken: string | undefined,
): Promise<RuntimeNode[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${url}/runtimes`, {
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`GET /runtimes ${res.status}`);
    }
    const body = await res.json();
    const runtimes: RemoteRuntimePayload[] = Array.isArray(body)
      ? body
      : (body.runtimes ?? []);
    return runtimes.map((rt) => toRuntimeNode(rt, url));
  } finally {
    clearTimeout(timer);
  }
}

/** GET {url}/runtimes/{id} for a single runtime. Returns null when the runtime
 *  no longer exists on the server (404), so the caller can drop it. */
async function getRemoteRuntime(
  url: string,
  id: string,
  idToken: string | undefined,
): Promise<RuntimeNode | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${url}/runtimes/${encodeURIComponent(id)}`, {
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      signal: controller.signal,
    });
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new Error(`GET /runtimes/${id} ${res.status}`);
    }
    const body = await res.json();
    // Both hosts return the runtime object directly; tolerate a wrapper.
    const payload: RemoteRuntimePayload = body?.runtimes?.[0] ?? body;
    return toRuntimeNode(payload, url);
  } finally {
    clearTimeout(timer);
  }
}

type RemoteState = {
  runtimes?: RuntimeNode[];
  error?: boolean;
  loading?: boolean;
};

const remoteKey = (rt: RuntimeClass): string => rt.name || rt.url || "";

/**
 * The Remotes source folder: each configured remote is a sub-folder whose
 * children are the runtimes currently running on that server (regardless of
 * which board they belong to). Returns null when the host provides no remotes
 * controller, so the source is omitted entirely.
 *
 * Runtimes are fetched eagerly for every configured remote (mirroring the
 * Cloud source's per-coordinator fetch) with a per-remote try/catch, so an
 * offline or unauthorised server degrades to a hint instead of failing the
 * whole source. Each remote row also exposes a manual refresh, since a runtime
 * list can change on the board that owns it without any signal to us.
 */
export function useRemotesFolder(
  remotes: RemotesController | undefined,
): FolderNode | null {
  const { user } = useAppContext();
  const [byRemote, setByRemote] = useState<Record<string, RemoteState>>({});
  // Per-runtime refresh spinners, keyed by `${remoteKey}/${runtimeId}`.
  const [busyRuntimes, setBusyRuntimes] = useState<Record<string, boolean>>({});

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const configured = useMemo(() => remotes?.runtimes ?? [], [remotes]);
  // Re-fetch when the set of remote URLs (or the auth token) changes.
  const urlsKey = configured.map((rt) => rt.url ?? "").join("|");

  const fetchRemote = useCallback(
    async (rt: RuntimeClass) => {
      const key = remoteKey(rt);
      if (!rt.url) {
        if (mountedRef.current) {
          setByRemote((prev) => ({ ...prev, [key]: { runtimes: [] } }));
        }
        return;
      }
      // Keep any already-shown runtimes while refreshing; drop a stale error.
      setByRemote((prev) => ({
        ...prev,
        [key]: { runtimes: prev[key]?.runtimes, loading: true },
      }));
      try {
        const runtimes = await listRemoteRuntimes(rt.url, user?.idToken);
        if (mountedRef.current) {
          setByRemote((prev) => ({ ...prev, [key]: { runtimes } }));
        }
      } catch {
        if (mountedRef.current) {
          setByRemote((prev) => ({ ...prev, [key]: { error: true } }));
        }
      }
    },
    [user?.idToken],
  );

  // Re-fetch just one runtime (its state can change on the board that owns it
  // without any signal to us) and splice it back into its remote's list.
  const refreshRuntime = useCallback(
    async (parent: RuntimeClass, runtimeId: string) => {
      if (!parent.url) {
        return;
      }
      const rkey = remoteKey(parent);
      const bkey = `${rkey}/${runtimeId}`;
      setBusyRuntimes((prev) => ({ ...prev, [bkey]: true }));
      try {
        const updated = await getRemoteRuntime(
          parent.url,
          runtimeId,
          user?.idToken,
        );
        if (mountedRef.current) {
          setByRemote((prev) => {
            const cur = prev[rkey];
            if (!cur?.runtimes) {
              return prev;
            }
            const runtimes = updated
              ? cur.runtimes.map((r) => (r.id === runtimeId ? updated : r))
              : cur.runtimes.filter((r) => r.id !== runtimeId);
            return { ...prev, [rkey]: { ...cur, runtimes } };
          });
        }
      } catch {
        // Leave the runtime as-is on a transient error.
      } finally {
        if (mountedRef.current) {
          setBusyRuntimes((prev) => {
            const next = { ...prev };
            delete next[bkey];
            return next;
          });
        }
      }
    },
    [user?.idToken],
  );

  useEffect(() => {
    if (configured.length === 0) {
      setByRemote({});
      return;
    }
    configured.forEach((rt) => void fetchRemote(rt));
    // configured is captured; urlsKey/fetchRemote (idToken) drive the refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlsKey, fetchRemote]);

  const folder = useMemo<FolderNode>(() => {
    const children = configured.map<FolderNode>((rt) => {
      const rkey = remoteKey(rt);
      const state = byRemote[rkey];
      const runtimes = (state?.runtimes ?? []).map<RuntimeNode>((node) => ({
        ...node,
        onRefresh: () => void refreshRuntime(rt, node.id),
        refreshing: busyRuntimes[`${rkey}/${node.id}`] ?? false,
      }));
      return {
        type: "folder",
        name: rt.name || rt.url || "Remote",
        art: rt.color,
        children: runtimes,
        emptyHint: state?.loading
          ? "Loading…"
          : state?.error
            ? "Unreachable — is the server running?"
            : state
              ? "No runtimes on this server"
              : "Loading…",
        onRefresh: rt.url ? () => void fetchRemote(rt) : undefined,
        refreshing: state?.loading ?? false,
      };
    });
    return {
      type: "folder",
      name: "Remotes",
      source: true,
      children,
      emptyHint: "Add a remote to browse its runtimes",
    };
  }, [configured, byRemote, busyRuntimes, fetchRemote, refreshRuntime]);

  return remotes ? folder : null;
}
