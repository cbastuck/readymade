import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  PinnableAction,
  PinsController,
} from "hkp-frontend/src/views/start";

import {
  addPin,
  listPins,
  Pin,
  pinOf,
  PINS_CHANGED,
  removePin,
  samePin,
} from "./homeScreen";

/**
 * The pinned boards as the shell keeps them, and the controller the start page
 * pins through. `pinnedTitle` is set after a pin the person still has to place
 * on the Home Screen themselves (iOS) — what the host shows its guide for.
 */
export function usePins(): {
  pins: PinsController;
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
    // A change made elsewhere: a board deleted from the Hub is unpinned
    // there (library/deleteBoard).
    const onChanged = (event: Event) =>
      setList((event as CustomEvent<Pin[]>).detail);
    window.addEventListener(PINS_CHANGED, onChanged);
    return () => window.removeEventListener(PINS_CHANGED, onChanged);
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

  return {
    pins,
    pinnedTitle,
    dismissPinned: () => setPinnedTitle(null),
  };
}
