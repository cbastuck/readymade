// Desktop share flow (see MobileApp.tsx for the iOS counterpart): envelopes
// pulled from the native inbox land on window.__READYMADE_SHARES__;
// `pendingShare` awaits the board choice in the picker (ShareOverlay),
// `shareToInject` is the chosen share the BoardShareConsumer (inside the
// playground) runs once the board is up.

import { useCallback, useEffect, useRef, useState } from "react";
import { SharePayload, drainNextShare } from "./shareInbox";
import { installDesktopShareInbox } from "./desktopShareInbox";
import { getBackend } from "../backend";

export type ShareFlow = {
  /** Share awaiting the user's board choice; set while the picker is up. */
  pendingShare: SharePayload | null;
  /** Saved-board names offered by the picker. */
  boards: string[];
  /** Chosen share, injected by the BoardShareConsumer once the board is up. */
  shareToInject: SharePayload | null;
  onPickBoard: (name: string) => void;
  onCancelShare: () => void;
  onShareConsumed: () => void;
};

/**
 * Owns the desktop share state machine: drains the native inbox, hands each
 * share to the picker exactly once, and queues shares that arrive while one
 * is already in flight.
 *
 * @param openBoard opens the picked board in the playground; a rejection puts
 * the flow back to idle and promotes the next queued share.
 */
export function useShareFlow(
  openBoard: (name: string) => Promise<void>,
): ShareFlow {
  const [pendingShare, setPendingShare] = useState<SharePayload | null>(null);
  const [shareToInject, setShareToInject] = useState<SharePayload | null>(null);
  const [boards, setBoards] = useState<string[]>([]);
  // True while a share is in flight (picking or injecting), so newly delivered
  // shares queue up instead of clobbering the UI.
  const shareActiveRef = useRef(false);

  const promoteNextShare = useCallback(() => {
    if (shareActiveRef.current) {
      return;
    }
    const next = drainNextShare();
    if (!next) {
      return;
    }
    console.log(
      "[ReadymadeShare] promoteNextShare drained:",
      next.url ?? next.text ?? next.id,
    );
    shareActiveRef.current = true;
    void getBackend()
      .then((backend) => backend.fetchSavedBoards())
      .then((names) => {
        setBoards(names);
        setPendingShare(next);
      })
      .catch(() => {
        setBoards([]);
        setPendingShare(next);
      });
  }, []);

  useEffect(() => {
    // The drain pushes envelopes onto the queue and then calls this; also
    // promote anything queued before mount (cold launch from the share menu).
    window.__readymadeOnShare = promoteNextShare;
    const uninstall = installDesktopShareInbox();
    promoteNextShare();
    return () => {
      uninstall();
      if (window.__readymadeOnShare === promoteNextShare) {
        delete window.__readymadeOnShare;
      }
    };
  }, [promoteNextShare]);

  const onPickBoard = useCallback(
    (name: string) => {
      // Keep shareActiveRef true through injection; released on consume.
      const share = pendingShare;
      setPendingShare(null);
      // Publish the payload only after openBoard has committed the remount:
      // set any earlier, a consumer inside an already-open board claims and
      // injects it there, and the remount then wipes that board.
      openBoard(name)
        .then(() => {
          setShareToInject(share);
        })
        .catch((err: unknown) => {
          console.error("[ReadymadeShare] could not open board", name, err);
          shareActiveRef.current = false;
          promoteNextShare();
        });
    },
    [pendingShare, openBoard, promoteNextShare],
  );

  const onCancelShare = useCallback(() => {
    shareActiveRef.current = false;
    setPendingShare(null);
    promoteNextShare();
  }, [promoteNextShare]);

  const onShareConsumed = useCallback(() => {
    setShareToInject(null);
    shareActiveRef.current = false;
    promoteNextShare();
  }, [promoteNextShare]);

  return {
    pendingShare,
    boards,
    shareToInject,
    onPickBoard,
    onCancelShare,
    onShareConsumed,
  };
}
