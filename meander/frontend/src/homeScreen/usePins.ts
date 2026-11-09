import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  PinnableAction,
  PinsController,
} from "hkp-frontend/src/views/start";

import {
  addPin,
  listPins,
  opensAsApp,
  Pin,
  pinOf,
  PINS_AS_APP_CHANGED,
  PINS_CHANGED,
  removePin,
  samePin,
  setOpensAsApp,
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
  // Bumped when a pin starts or stops opening as an app, which is read from
  // its store rather than kept here.
  const [asAppVersion, setAsAppVersion] = useState(0);

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
    const onAsAppChanged = () => setAsAppVersion((n) => n + 1);
    window.addEventListener(PINS_CHANGED, onChanged);
    window.addEventListener(PINS_AS_APP_CHANGED, onAsAppChanged);
    return () => {
      window.removeEventListener(PINS_CHANGED, onChanged);
      window.removeEventListener(PINS_AS_APP_CHANGED, onAsAppChanged);
    };
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
      opensAsApp: (action) => opensAsApp(pinOf(action, "")),
      setOpensAsApp: (action, asApp) => setOpensAsApp(pinOf(action, ""), asApp),
    }),
    // A new controller when a pin's choice changes, so what reads it renders.
    [isPinned, asAppVersion], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return {
    pins,
    pinnedTitle,
    dismissPinned: () => setPinnedTitle(null),
  };
}
