import { useEffect, useRef } from "react";
import { useBoardContext } from "hkp-frontend/src/BoardContext";
import { SharePayload } from "./shareInbox";

/**
 * Injects a captured share into the currently open board and runs it once.
 *
 * Rendered inside the board's `BoardProvider`, so it can reach `onAction`. It
 * waits until the board has finished loading and the first runtime's scope
 * exists, then dispatches `playBoard` with the share envelope as the pipeline
 * head input — the same action a Board service's play button fires. Because the
 * context value is recreated on every state change, this effect re-runs as the
 * board hydrates and fires as soon as the runtime is ready; `firedForRef`
 * guarantees exactly one injection per share.
 */
export default function BoardShareConsumer({
  payload,
  onConsumed,
}: {
  payload: SharePayload | null;
  onConsumed: () => void;
}) {
  const board = useBoardContext();
  const firedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!board || !payload) {
      return;
    }
    if (firedForRef.current === payload.id) {
      return;
    }
    if (board.isFetching) {
      return;
    }
    const firstRuntime = board.runtimes[0];
    if (!firstRuntime) {
      return;
    }
    if (!board.scopes[firstRuntime.id]) {
      return;
    }

    firedForRef.current = payload.id;
    board.onAction({ type: "playBoard", params: payload });
    onConsumed();
  }, [board, payload, onConsumed]);

  return null;
}
