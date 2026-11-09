import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import { HISTORY_KEY as DETAIL_HISTORY_KEY } from "./MobileFacadeView";

/**
 * App mode: a board's facade on the whole screen, with none of the
 * playground's bars around it — the board used as the app it was built to be.
 *
 * It is a step the phone's own back gesture takes back, so entering pushes a
 * history entry and leaving is a pop, the same bargain the facade's details
 * make (`MobileFacadeView`). The entry is marked with this session's id, so an
 * entry left from before a reload is not mistaken for one of ours.
 */
export type AppMode = {
  active: boolean;
  enter: () => void;
  exit: () => void;
};

const APP_MODE_KEY = "hkpAppMode";

const AppModeContext = createContext<AppMode | null>(null);

export const AppModeProvider = AppModeContext.Provider;

/** Null outside a shell that can show a board without its bars. */
export function useAppMode(): AppMode | null {
  return useContext(AppModeContext);
}

function markedBy(state: unknown, session: string): boolean {
  return (
    !!state &&
    typeof state === "object" &&
    (state as Record<string, unknown>)[APP_MODE_KEY] === session
  );
}

export function useAppModeState(): AppMode {
  const [active, setActiveRaw] = useState(false);
  const activeRef = useRef(active);
  const setActive = (next: boolean) => {
    activeRef.current = next;
    setActiveRaw(next);
  };
  const [session] = useState(() => Math.random().toString(36).slice(2));
  // Set while leaving from somewhere other than the back gesture: the pops
  // carry on until they land below the entry app mode was entered with,
  // however many details were opened on top of it.
  const leaving = useRef(false);

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const marked = markedBy(event.state, session);
      if (marked && leaving.current) {
        window.history.back();
        return;
      }
      leaving.current = false;
      setActive(marked);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const enter = useCallback(() => {
    if (activeRef.current) {
      return;
    }
    // Without the detail open at the moment: back from a detail opened before
    // would otherwise step out of app mode along with it.
    const state = { ...((window.history.state ?? {}) as Record<string, unknown>) };
    delete state[DETAIL_HISTORY_KEY];
    window.history.pushState({ ...state, [APP_MODE_KEY]: session }, "");
    setActive(true);
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const exit = useCallback(() => {
    if (!activeRef.current) {
      return;
    }
    if (markedBy(window.history.state, session)) {
      leaving.current = true;
      window.history.back();
    } else {
      setActive(false);
    }
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  return { active, enter, exit };
}

/** How long two fingers rest on the screen before it counts as a hold. */
const HOLD_MS = 700;
/** How far a finger may drift during a hold, so a pinch or a scroll is none. */
const HOLD_SLOP_PX = 14;

/**
 * Calls `onHold` when two fingers rest on the element for a moment. The way out
 * of app mode wherever the system offers none: no facade widget asks for two
 * fingers held still, so nothing a reader does with one is taken from them.
 * The listeners are passive and the touches still reach the widgets.
 */
export function useTwoFingerHold(
  ref: RefObject<HTMLElement | null>,
  onHold: () => void,
  enabled: boolean,
) {
  const onHoldRef = useRef(onHold);
  onHoldRef.current = onHold;

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let start: Array<{ x: number; y: number }> = [];
    const cancel = () => {
      clearTimeout(timer);
      timer = undefined;
    };
    const points = (touches: TouchList) =>
      Array.from(touches).map((t) => ({ x: t.clientX, y: t.clientY }));

    const onStart = (event: TouchEvent) => {
      cancel();
      if (event.touches.length !== 2) {
        return;
      }
      start = points(event.touches);
      timer = setTimeout(() => {
        timer = undefined;
        onHoldRef.current();
      }, HOLD_MS);
    };
    const onMove = (event: TouchEvent) => {
      if (!timer) {
        return;
      }
      const now = points(event.touches);
      if (
        now.length !== 2 ||
        now.some(
          (p, i) =>
            Math.hypot(p.x - start[i].x, p.y - start[i].y) > HOLD_SLOP_PX,
        )
      ) {
        cancel();
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", cancel, { passive: true });
    el.addEventListener("touchcancel", cancel, { passive: true });
    return () => {
      cancel();
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", cancel);
      el.removeEventListener("touchcancel", cancel);
    };
  }, [ref, enabled]);
}
