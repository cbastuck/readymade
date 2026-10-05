import { useCallback, useEffect, useRef, useState } from "react";
import {
  CoordinatorSnapshotStore,
  ServiceStateMessage,
  SnapshotMessage,
} from "./coordinatorSnapshot";
import { BoardContextState } from "../../BoardContext";
import {
  decodeBinaryFrame,
  encodeBinaryFrame,
  fromBinaryValue,
  toBinaryValue,
} from "./bridgeBinary";
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
  /**
   * Asks the coordinator to have a service do its job with a payload, running
   * the pipeline from that service onward. Resolves once the work is taken;
   * what it produces arrives as notifications. The run is this browser's: its
   * caller is whoever the coordinator verified when the bridge attached.
   */
  processRemoteService: (
    runtimeId: string,
    serviceUuid: string,
    payload: unknown,
  ) => Promise<unknown>;
  /**
   * Why the coordinator will not have this browser on the board, once it has
   * said so; null while attached or still trying. A bridge that is refused is
   * not reconnected: asking again gets the same answer.
   */
  refused: BridgeRefusal | null;
};

/**
 * "removed": the board was shared with this person and no longer is.
 * "not-found": no such board for them — it does not exist, or is not shared
 * with them, which a coordinator answers the same way on purpose.
 */
export type BridgeRefusal = "removed" | "not-found";

/** The close code a coordinator ends a member's bridge with on removal. */
const CLOSE_NOT_A_MEMBER = 4403;

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
  /**
   * Attaching as somebody the board is shared with rather than as its owner.
   * A member's bridge hosts no runtime, and a refusal is final for it: the
   * owner's bridge keeps retrying because a board being deployed again is
   * briefly away, while a member who is refused has been told.
   */
  asMember = false,
): CoordinatorBridge {
  const wsRef = useRef<WebSocket | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [refused, setRefused] = useState<BridgeRefusal | null>(null);
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

  const runtimeIds = asMember
    ? []
    : (boardContext?.runtimes ?? [])
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
    // Whether the coordinator told this bridge the board at all. A member's
    // bridge that closes without having been told was not let in.
    let attached = false;
    setRefused(null);

    const ws = new WebSocket(withAccessToken(wsUrl, idToken));
    // Input that holds bytes arrives as a binary frame; see bridgeBinary.
    ws.binaryType = "arraybuffer";
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
      if (event.data instanceof ArrayBuffer) {
        const frame = decodeBinaryFrame(event.data);
        if (!frame || frame.header.type !== "processRuntime") {
          return;
        }
        msg = {
          ...frame.header,
          params: fromBinaryValue(frame.value),
        } as BridgeInboundMessage;
      } else {
        try {
          msg = JSON.parse(event.data as string);
        } catch {
          return;
        }
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
        attached = true;
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
          if (ws.readyState !== WebSocket.OPEN) {
            return;
          }
          // Bytes go as a binary frame: as text they would arrive at the
          // next runtime as an object of numbered keys.
          const binary = toBinaryValue(result);
          ws.send(
            binary
              ? encodeBinaryFrame({ type: "result", requestId }, binary)
              : JSON.stringify({ type: "result", requestId, data: result }),
          );
        },
      });
    };

    ws.onerror = () => {
      console.warn("[bridge] Coordinator bridge WebSocket error");
    };

    ws.onclose = (event) => {
      console.log("[bridge] Coordinator bridge disconnected");
      const removed = event.code === CLOSE_NOT_A_MEMBER;
      if (removed || (asMember && !attached)) {
        // Said, not retried: the answer would be the same, and a client that
        // kept asking would be knocking on a door it was shown out of.
        intentionallyClosed = true;
        setRefused(removed ? "removed" : "not-found");
      }
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
  }, [
    wsUrl,
    userId,
    boardName,
    reconnectAttempt,
    idToken,
    sendRegistration,
    snapshot,
    asMember,
  ]);

  // Re-register runtimeIds with the already-open socket when new browser
  // runtimes are added to the board.
  useEffect(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendRegistration(ws);
    }
  }, [runtimeIdsKey, sendRegistration]);

  // Carry what this board's browser runtimes record to the coordinator, which
  // is the only instance that keeps a board's log — a browser closes, and the
  // entries have to outlive it. Remote runtimes send their own over their own
  // connection; this is the leg only a browser can serve.
  //
  // Re-registered whenever the board's browser runtimes change, for the same
  // reason the registration above is: a runtime added later would otherwise
  // record into nothing.
  useEffect(() => {
    const context = boardContextRef.current;
    if (!context) {
      return;
    }

    const releases: Array<() => void> = [];
    for (const runtimeId of runtimeIdsRef.current) {
      const scope = context.scopes[runtimeId];
      if (!scope || typeof scope.registerLogTarget !== "function") {
        continue;
      }
      releases.push(
        scope.registerLogTarget((entry) => {
          const ws = wsRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "log", entry }));
          }
        }),
      );
    }

    return () => {
      for (const release of releases) {
        release();
      }
    };
  }, [runtimeIdsKey]);

  /** Sends a request over the bridge and resolves with what answers it. */
  const request = useCallback(
    (prefix: string, message: Record<string, unknown>) =>
      new Promise<unknown>((resolve, reject) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          reject(new Error("Not attached to a coordinator"));
          return;
        }
        const requestId = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        pendingRef.current.set(requestId, { resolve, reject });
        ws.send(JSON.stringify({ ...message, requestId }));
      }),
    [],
  );

  const configureRemoteService = useCallback(
    (runtimeId: string, serviceUuid: string, config: unknown) =>
      request("cfg", {
        type: "configureService",
        runtimeId,
        serviceUuid,
        config,
      }),
    [request],
  );

  const processRemoteService = useCallback(
    (runtimeId: string, serviceUuid: string, payload: unknown) =>
      request("proc", {
        type: "processService",
        runtimeId,
        serviceUuid,
        payload,
      }),
    [request],
  );

  return {
    ws: wsRef.current,
    snapshot,
    configureRemoteService,
    processRemoteService,
    refused,
  };
}
