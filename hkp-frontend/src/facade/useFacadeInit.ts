import { useEffect, useReducer, useRef } from "react";

import { BoardContextState } from "hkp-frontend/src/BoardContext";
import {
  canReachService,
  isBuiltInside,
  whenServiceConnected,
} from "./boardServices";
import { executeActions } from "./executeActions";
import { FacadeIdentity } from "./FacadeIdentity";
import { FacadeDescriptor } from "./types";

/** How often init asks again whether a sub-service has built what it names. */
const RECHECK_MS = 50;

/**
 * How long init waits for that before running anyway, as it did when only the
 * holder was asked about: an address spelled wrong is never built, and should
 * not keep the rest of init from running.
 */
const BUILD_WAIT_MS = 5000;

/**
 * Runs a facade's `init` once per board — once the services it names can be
 * reached.
 *
 * Not on mount: a facade is known before its board's runtimes are restored,
 * and on a board attached through a coordinator before the board is hydrated
 * at all. What `init` asks of a service then finds nothing and is dropped, and
 * a board whose first view depends on it — a poll that reads its meetings on
 * opening — shows nothing, with nothing on screen to tap that would fetch it.
 *
 * A service inside a sub-service is waited for until it is built, not only
 * until its holder is: the widgets showing it subscribe to it then, in the
 * render that finds it and so before this effect runs. Nothing redraws a
 * facade when a sub-service finishes building, so init asks again by itself.
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
  const named = init
    .map((action) => (action as { serviceUuid?: unknown }).serviceUuid)
    .filter((uuid): uuid is string => typeof uuid === "string");
  const reachable = named.every((uuid) => canReachService(boardContext, uuid));
  const built = named.every((uuid) => isBuiltInside(boardContext, uuid));

  const ranFor = useRef<string | null>(null);
  const building = useRef<{ boardName: string; since: number } | null>(null);
  const [, recheck] = useReducer((n: number) => n + 1, 0);

  let ready = reachable && built;
  if (reachable && !built) {
    if (building.current?.boardName !== boardName) {
      building.current = { boardName, since: Date.now() };
    }
    ready = Date.now() - building.current.since >= BUILD_WAIT_MS;
  }
  const waiting = reachable && !ready && ranFor.current !== boardName;

  useEffect(() => {
    if (!waiting) {
      return;
    }
    const timer = setTimeout(recheck, RECHECK_MS);
    return () => clearTimeout(timer);
  });

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
