import { useCallback, useEffect, useRef, useState } from "react";
import { BoardContextState } from "../../BoardContext";
import {
  isRuntimeBrowserClassType,
  toCanonicalRuntimeClassType,
} from "../../types";

export type CoordinatorBridge = {
  ws: WebSocket | null;
};

type BridgeInboundMessage = {
  type: "processRuntime";
  runtimeId: string;
  params: unknown;
  requestId: string;
};

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
): CoordinatorBridge {
  const wsRef = useRef<WebSocket | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

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
  }, [wsUrl, userId, boardName, reconnectAttempt, idToken, sendRegistration]);

  // Re-register runtimeIds with the already-open socket when new browser
  // runtimes are added to the board.
  useEffect(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendRegistration(ws);
    }
  }, [runtimeIdsKey, sendRegistration]);

  return { ws: wsRef.current };
}
