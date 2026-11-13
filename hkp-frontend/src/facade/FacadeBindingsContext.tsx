import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { useBoardScene } from "hkp-frontend/src/overview/useBoardScene";
import { canReachService } from "./boardServices";
import {
  BindingSite,
  FacadeBindings,
  facadeBindings,
  siteKey,
} from "./bindings";
import { useFacadePanelNavigation } from "./FacadePanelNavigation";
import { locateService, ServiceLocation } from "./serviceLocation";
import { FacadeDescriptor } from "./types";

/**
 * What the facade's binding badges share: the facade-level index (who writes
 * and reads each state key), where a service lives on the board, and how to
 * bring another widget into view.
 *
 * Available wherever a facade is rendered, for the facade editor to use too.
 * The badges are drawn only while the facade and the board's runtimes are on
 * screen together (`badges`), which is the one view where a badge has
 * somewhere to point at a glance: the fullscreen facade is an app, and a
 * member's view holds no board.
 *
 * The board's shape — what tells a nested service from a missing one — is read
 * once for the whole facade rather than per widget, and only once an overlay
 * has asked for it: reading it asks every service for its configuration. Each
 * overlay opening reads it again, since a pipeline built since changes it.
 */
export type FacadeBindingsApi = {
  /** Whether badges are drawn on the widgets and the divider. */
  badges: boolean;
  index: FacadeBindings;
  locate: (address: string) => ServiceLocation;
  /** Asks for the board's shape to be read, or read again. */
  refreshLocations: () => void;
  /** Brings a facade widget into view and marks it for a moment. */
  revealWidget: (site: BindingSite) => void;
};

const FacadeBindingsCtx = createContext<FacadeBindingsApi | null>(null);

export function useFacadeBindings(): FacadeBindingsApi | null {
  return useContext(FacadeBindingsCtx);
}

/** How long a facade widget stays marked after a binding pointed at it. */
const WIDGET_HIGHLIGHT_MS = 2000;
const WIDGET_REVEAL_TIMEOUT_MS = 1000;
const REVEALED_CLASS = "hkp-facade-widget--revealed";

/** The attribute a widget's wrapper carries its site under. */
export const SITE_ATTRIBUTE = "data-facade-site";

export function FacadeBindingsProvider({
  facade,
  boardContext,
  badges,
  children,
}: {
  facade: FacadeDescriptor;
  boardContext: BoardContextState;
  badges: boolean;
  children: ReactNode;
}) {
  const [generation, setGeneration] = useState(0);
  // Read once something has asked where a service lives, and again each time.
  const { scene, settled } = useBoardScene(
    boardContext,
    generation > 0,
    "lanes",
    generation,
  );
  const index = useMemo(() => facadeBindings(facade), [facade]);
  const navigation = useFacadePanelNavigation();

  const locate = useCallback(
    (address: string) =>
      locateService(scene, address, {
        settled,
        linkage: boardContext.linkage?.blocks,
        isReachable: (each) => canReachService(boardContext, each),
      }),
    [scene, settled, boardContext],
  );

  const refreshLocations = useCallback(
    () => setGeneration((n) => n + 1),
    [],
  );

  const revealWidget = useCallback(
    (site: BindingSite) => {
      if (site.kind !== "widget") {
        return;
      }
      // A panel on another tab is brought on screen first.
      navigation?.showPanel(site.panel);
      const key = siteKey(site);
      const deadline = performance.now() + WIDGET_REVEAL_TIMEOUT_MS;
      const look = () => {
        // Compared rather than put in a selector: a panel id may hold anything.
        const element = Array.from(
          document.querySelectorAll(`[${SITE_ATTRIBUTE}]`),
        ).find((each) => each.getAttribute(SITE_ATTRIBUTE) === key);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.classList.add(REVEALED_CLASS);
          setTimeout(
            () => element.classList.remove(REVEALED_CLASS),
            WIDGET_HIGHLIGHT_MS,
          );
          return;
        }
        if (performance.now() < deadline) {
          requestAnimationFrame(look);
        }
      };
      requestAnimationFrame(look);
    },
    [navigation],
  );

  const value = useMemo(
    () => ({ badges, index, locate, refreshLocations, revealWidget }),
    [badges, index, locate, refreshLocations, revealWidget],
  );

  return (
    <FacadeBindingsCtx.Provider value={value}>
      {children}
    </FacadeBindingsCtx.Provider>
  );
}
