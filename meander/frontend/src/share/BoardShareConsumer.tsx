import { useEffect, useRef } from "react";
import { useBoardContext } from "hkp-frontend/src/BoardContext";
import {
  SharePayload,
  ShareInput,
  fetchSharedFileData,
  releaseSharedFile,
} from "./shareInbox";

/**
 * Injects a captured share into the currently open board and runs it once.
 *
 * Rendered inside the board's `BoardProvider`, so it can reach `onAction`. It
 * waits until the board has finished loading and the first runtime's scope
 * exists, then dispatches `playBoard` with the share envelope as the pipeline
 * head input — the same action a Board service's play button fires. If the
 * share carries a binary payload (image/file), the bytes are fetched from the
 * native shell first and injected as `file.data` (Uint8Array), then released
 * so the native side can delete the stored file.
 *
 * Because the context value is recreated on every state change, this effect
 * re-runs as the board hydrates and fires as soon as the runtime is ready;
 * `firedForRef` guarantees exactly one injection per share.
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

    // Claim the share before any async work so a re-render mid-fetch cannot
    // start a second injection.
    firedForRef.current = payload.id;

    const inject = async () => {
      let input: ShareInput = payload;
      if (payload.file) {
        const data = await fetchSharedFileData(payload.id);
        if (data) {
          input = { ...payload, file: { ...payload.file, data } };
        } else {
          console.warn(
            "[ReadymadeShare] file payload missing for share",
            payload.id,
          );
        }
      }

      board.onAction({ type: "playBoard", params: input });

      if (payload.file) {
        releaseSharedFile(payload.id);
      }
      onConsumed();
    };

    void inject();
  }, [board, payload, onConsumed]);

  return null;
}
