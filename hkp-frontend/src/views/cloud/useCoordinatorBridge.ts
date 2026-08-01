import { useCallback, useEffect, useRef, useState } from "react";
import {
  CoordinatorSnapshotStore,
  ServiceStateMessage,
  SnapshotMessage,
} from "./coordinatorSnapshot";
import { BoardContextState } from "../../BoardContext";
import {
  isRuntimeBrowserClassType,
  toCanonicalRuntimeClassType,
} from "../../types";

export type CoordinatorBridge = {
  ws: WebSocket | null;
  /** The board as the coordinator reports it; empty until a snapshot arrives. */
  snapshot: CoordinatorSnapshotStore;
  /**
   * Asks the coordinator to configure a service on a runtime it owns. The
   * browser does not dial those runtimes itself — that is what makes a cloud
   * board's runtimes free to live where the browser cannot reach.
   */
  configureRemoteService: (
    runtimeId: string,
    serviceUuid: string,
    config: unknown,
  ) => Promise<unknown>;
};

type BridgeInboundMessage =
  | {
      type: "processRuntime";
      runtimeId: string;
      params: unknown;
      requestId: string;
    }
  | SnapshotMessage
  | ServiceStateMessage
  | {
      type: "notification";
      runtimeId: string;
      serviceUuid: string;
      payload: unknown;
    }
  | { type: "response"; requestId: string; data?: unknown; error?: string };

/** Append the bearer token to a WebSocket URL as ?access_token= for auth. */
function withAccessToken(wsUrl: string, token: string | null): string {
  if (!token) {
    return wsUrl;
  }
  const url = new URL(wsUrl);
  url.searchParams.set("access_token", token);
  return url.toString();
}

export function useCoordinatorBridge(
  wsUrl: string | null,
  userId: string | null,
  boardName: string | null,
  boardContext: BoardContextState | null,
  idToken: string | null = null,
  /**
   * The store to fill. The host creates it when it needs to build things that
   * read from it — the attached-mode runtime api, the board coordinator — which
   * live outside this hook. Omitted, the hook keeps its own.
   */
  externalSnapshot?: CoordinatorSnapshotStore,
): CoordinatorBridge {
  const wsRef = useRef<WebSocket | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  // One store for the hook's lifetime: scopes and the board coordinator hold a
  // reference to it and read through, so replacing it would strand them.
  const snapshotRef = useRef<CoordinatorSnapshotStore | null>(null);
  if (!snapshotRef.current) {
    snapshotRef.current = new CoordinatorSnapshotStore();
  }
  const snapshot = externalSnapshot ?? snapshotRef.current;
  const pendingRef = useRef(
    new Map<string, { resolve: (data: unknown) => void; reject: (err: Error) => void }>(),
  );

  const runtimeIds = (boardContext?.runtimes ?? [])
    .filter((rt) => isRuntimeBrowserClassType(rt.type))
    .map((rt) => rt.id);
  const runtimeIdsKey = runtimeIds.join(",");

  // Capture the latest boardContext in a ref so the onmessage handler always
  // reads current scopes/runtimeApis without needing to re-open the WebSocket.
  const boardContextRef = useRef(boardContext);
  boardContextRef.current = boardContext;

  // runtimeIds is a fresh array each render. The connection effect must NOT
  // reconnect when it changes (a dedicated effect re-registers on the live
  // socket), so read the latest value through a ref instead of a dependency.
  const runtimeIdsRef = useRef(runtimeIds);
  runtimeIdsRef.current = runtimeIds;

  const sendRegistration = useCallback(
    (ws: WebSocket) => {
      ws.send(
        JSON.stringify({
          type: "connect",
          userId,
          boardName,
          runtimeIds: runtimeIdsRef.current,
        }),
      );
    },
    [userId, boardName],
  );

  useEffect(() => {
    if (!wsUrl || !userId || !boardName) {
      return;
    }

    // Closure-local flag — each effect invocation owns its own copy. This
    // prevents the race where React runs cleanup synchronously (setting the
    // flag) and then immediately starts the new effect (which would reset a
    // shared ref), so that when onclose finally fires asynchronously it sees
    // the wrong value and triggers a spurious reconnect loop.
    let intentionallyClosed = false;

    const ws = new WebSocket(withAccessToken(wsUrl, idToken));
    wsRef.current = ws;

    ws.onopen = () => {
      // If we were torn down while still connecting (e.g. StrictMode's
      // mount→unmount→mount in dev), close cleanly now instead of registering —
      // closing an already-open socket avoids the browser's noisy
      // "closed before the connection is established" error.
      if (intentionallyClosed) {
        ws.close();
        return;
      }
      console.log("[bridge] Connected to coordinator bridge");
      sendRegistration(ws);
    };

    ws.onmessage = (event) => {
      const ctx = boardContextRef.current;
      if (!ctx) {
        return;
      }
      let msg: BridgeInboundMessage;
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }

      // A service on a runtime we reach through the coordinator said something.
      // Hand it to that runtime's scope, which delivers it to the panels
      // registered for it — the same path a runtime's own socket would take.
      if (msg.type === "notification") {
        const scope = ctx.scopes[msg.runtimeId] as
          | { notify?: (serviceUuid: string, payload: unknown) => void }
          | undefined;
        scope?.notify?.(msg.serviceUuid, msg.payload);
        return;
      }

      if (msg.type === "snapshot" || msg.type === "serviceState") {
        const { needsResync } = snapshot.apply(msg);
        if (needsResync && ws.readyState === WebSocket.OPEN) {
          // A gap: better to be told the board again than to render a view
          // patched from increments that did not all arrive.
          ws.send(JSON.stringify({ type: "resync" }));
        }
        return;
      }

      if (msg.type === "response") {
        const pending = pendingRef.current.get(msg.requestId);
        if (pending) {
          pendingRef.current.delete(msg.requestId);
          if (msg.error) {
            pending.reject(new Error(msg.error));
          } else {
            pending.resolve(msg.data);
          }
        }
        return;
      }

      if (msg.type !== "processRuntime") {
        return;
      }

      const { runtimeId, params, requestId } = msg;
      const scope = ctx.scopes[runtimeId];
      const api =
        ctx.runtimeApis["browser"] ??
        (() => {
          const rt = ctx.runtimes.find((r) => r.id === runtimeId);
          return rt
            ? ctx.runtimeApis[toCanonicalRuntimeClassType(rt.type)]
            : undefined;
        })();

      if (!scope || !api) {
        console.warn(
          `[bridge] No scope or API for browser runtime "${runtimeId}"`,
        );
        return;
      }

      api.processRuntime(scope, params, null, {
        requestId,
        onResolve: (result: unknown) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({ type: "result", requestId, data: result }),
            );
          }
        },
      });
    };

    ws.onerror = () => {
      console.warn("[bridge] Coordinator bridge WebSocket error");
    };

    ws.onclose = () => {
      console.log("[bridge] Coordinator bridge disconnected");
      // Whatever was cached describes a session that is gone; the coordinator
      // sends a fresh snapshot when the browser attaches again.
      snapshot.clear();
      for (const [requestId, pending] of pendingRef.current) {
        pendingRef.current.delete(requestId);
        pending.reject(new Error("Coordinator bridge disconnected"));
      }
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      if (!intentionallyClosed) {
        // The server closed the connection (e.g. session was replaced after a
        // board infrastructure change). Wait long enough for the coordinator to
        // finish registering the new session, then reconnect.
        setTimeout(() => {
          if (!intentionallyClosed) {
            setReconnectAttempt((n) => n + 1);
          }
        }, 600);
      }
    };

    return () => {
      intentionallyClosed = true;
      wsRef.current = null;
      // Aborting a still-connecting socket makes the browser log a (harmless)
      // error; instead let onopen close it once the handshake completes.
      if (ws.readyState !== WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [wsUrl, userId, boardName, reconnectAttempt, idToken, sendRegistration, snapshot]);

  // Re-register runtimeIds with the already-open socket when new browser
  // runtimes are added to the board.
  useEffect(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendRegistration(ws);
    }
  }, [runtimeIdsKey, sendRegistration]);

  const configureRemoteService = useCallback(
    (runtimeId: string, serviceUuid: string, config: unknown) =>
      new Promise<unknown>((resolve, reject) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          reject(new Error("Not attached to a coordinator"));
          return;
        }
        const requestId = `cfg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        pendingRef.current.set(requestId, { resolve, reject });
        ws.send(
          JSON.stringify({
            type: "configureService",
            requestId,
            runtimeId,
            serviceUuid,
            config,
          }),
        );
      }),
    [],
  );

  return { ws: wsRef.current, snapshot, configureRemoteService };
}
