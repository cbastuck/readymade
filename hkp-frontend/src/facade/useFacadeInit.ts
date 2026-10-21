import { useEffect, useRef } from "react";

import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { canReachService, whenServiceConnected } from "./boardServices";
import { executeActions } from "./executeActions";
import { FacadeIdentity } from "./FacadeIdentity";
import { FacadeDescriptor } from "./types";

/**
 * Runs a facade's `init` once per board — once the services it names can be
 * reached.
 *
 * Not on mount: a facade is known before its board's runtimes are restored,
 * and on a board attached through a coordinator before the board is hydrated
 * at all. What `init` asks of a service then finds nothing and is dropped, and
 * a board whose first view depends on it — a poll that reads its meetings on
 * opening — shows nothing, with nothing on screen to tap that would fetch it.
 */
export function useFacadeInit({
  facade,
  boardContext,
  boardName,
  setState,
  stateRef,
  identity,
}: {
  facade: FacadeDescriptor;
  boardContext: BoardContextState;
  boardName: string;
  setState: (key: string, value: unknown) => void;
  stateRef: { current: Record<string, unknown> };
  identity: FacadeIdentity;
}): void {
  const init = facade.init ?? [];
  const ready = init.every((action) => {
    const uuid = (action as { serviceUuid?: unknown }).serviceUuid;
    return typeof uuid !== "string" || canReachService(boardContext, uuid);
  });

  const ranFor = useRef<string | null>(null);
  useEffect(() => {
    if (!init.length || !ready || ranFor.current === boardName) {
      return;
    }
    ranFor.current = boardName;
    // Reachable is not yet listening: a remote runtime answers a call before
    // its socket has opened, and the notification that would draw the first
    // view goes nowhere. Init runs once, so it waits for the runtimes it calls.
    void (async () => {
      await Promise.all(
        init.map((action) => {
          const uuid = (action as { serviceUuid?: unknown }).serviceUuid;
          return typeof uuid === "string"
            ? whenServiceConnected(boardContext, uuid)
            : undefined;
        }),
      );
      await executeActions({
        actions: init,
        value: undefined,
        boardContext,
        setState,
        state: stateRef.current,
        identity,
      });
    })();
  }, [boardName, ready]); // eslint-disable-line react-hooks/exhaustive-deps
}
