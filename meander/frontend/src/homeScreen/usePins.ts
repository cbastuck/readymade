import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  PinnableAction,
  PinsController,
} from "hkp-frontend/src/views/start";

import { addPin, listPins, Pin, pinOf, removePin, samePin } from "./homeScreen";

/**
 * The pinned boards as the shell keeps them, and the controller the start page
 * pins through. `pinnedTitle` is set after a pin the person still has to place
 * on the Home Screen themselves (iOS) — what the host shows its guide for.
 */
export function usePins(): {
  pins: PinsController;
  unpinIfPinned: (action: PinnableAction) => Promise<void>;
  pinnedTitle: string | null;
  dismissPinned: () => void;
} {
  const [list, setList] = useState<Pin[]>([]);
  const [pinnedTitle, setPinnedTitle] = useState<string | null>(null);

  useEffect(() => {
    // A shell without the route (an older build) has nothing pinned; the
    // start page then offers Pin and reports the failure if it is tried.
    void listPins()
      .then(setList)
      .catch(() => {});
  }, []);

  const isPinned = useCallback(
    (action: PinnableAction) => list.some((pin) => samePin(pin, pinOf(action, ""))),
    [list],
  );

  const pins = useMemo<PinsController>(
    () => ({
      isPinned,
      pin: async (action, title) => {
        const { pins: next, placement } = await addPin(pinOf(action, title));
        setList(next);
        if (placement === "manual") {
          setPinnedTitle(title);
        }
      },
      unpin: async (action) => {
        setList(await removePin(pinOf(action, "")));
      },
    }),
    [isPinned],
  );

  const unpinIfPinned = useCallback(
    async (action: PinnableAction) => {
      if (isPinned(action)) {
        setList(await removePin(pinOf(action, "")));
      }
    },
    [isPinned],
  );

  return {
    pins,
    unpinIfPinned,
    pinnedTitle,
    dismissPinned: () => setPinnedTitle(null),
  };
}
