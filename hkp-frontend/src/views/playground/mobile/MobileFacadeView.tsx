import { useCallback, useEffect, useRef, useState } from "react";

import { BoardContextState } from "../../../BoardContext";
import { FacadeStateContext } from "../../../facade/FacadeStateContext";
import { FacadeBoardActionsProvider } from "../../../facade/FacadeBoardActions";
import { FacadePanelNavigationContext } from "../../../facade/FacadePanelNavigation";
import { FacadeNotices } from "../../../facade/FacadeNotices";
import { FacadeTabBar } from "../../../facade/FacadeTabBar";
import { useFacadeInit } from "../../../facade/useFacadeInit";
import { useFacadeIdentity } from "../../../facade/FacadeIdentity";
import { PanelRenderer } from "../../../facade/panels/PanelRenderer";
import { currentFace, defaultFaceId, resolveFaces } from "../../../facade/tabs";
import {
  detailChain,
  isDetail,
  rootMasterOf,
} from "../../../facade/details";
import { FacadeDescriptor, FacadePanel } from "../../../facade/types";
import { SwimlaneDragProvider } from "../../../facade/SwimlaneDragContext";
import { usePressFeedback } from "../../../facade/pressFeedback";

/**
 * Touch-friendly facade renderer for the mobile board view. Mirrors the core of
 * the desktop `FacadeRenderer` (facade state store, `facade.init`, tabs,
 * notices, panel rendering) without its mouse-driven splitters / side-by-side
 * editor. Panels stack vertically and scroll.
 *
 * Tabs matter more here than on the desktop, not less: a phone shows one panel's
 * worth of screen, so a facade that puts its setting-up controls in the way
 * costs a reader the whole view rather than a column of it.
 *
 * Details (`FacadePanel.detailOf`) are the exception to stacking: a detail under
 * its master is a whole list's scroll away, so it is opened over the master
 * instead, by a `show-panel` action, and closed again by its back bar or by the
 * system's back gesture.
 */
export default function MobileFacadeView({
  facade,
  boardContext,
  boardName,
}: {
  facade: FacadeDescriptor;
  boardContext: BoardContextState;
  boardName: string;
}) {
  const [facadeState, setFacadeStateRaw] = useState<Record<string, unknown>>(
    () => facade.state ?? {},
  );

  useEffect(() => {
    setFacadeStateRaw(facade.state ?? {});
  }, [boardName]);

  const setFacadeStateEntry = useCallback((key: string, value: unknown) => {
    setFacadeStateRaw((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Keep a ref so the init effect always sees the latest state at fire time.
  const facadeStateRef = useRef(facadeState);
  facadeStateRef.current = facadeState;
  const identity = useFacadeIdentity(boardContext);

  useFacadeInit({
    facade,
    boardContext,
    boardName,
    setState: setFacadeStateEntry,
    stateRef: facadeStateRef,
    identity,
  });

  // The board says which tab opens; switching is not remembered, and a facade
  // with no tabs is one face holding every panel.
  const { shared, faces } = resolveFaces(facade);
  const [chosenTab, setChosenTab] = useState<string | null>(() =>
    defaultFaceId(facade),
  );
  useEffect(() => {
    setChosenTab(defaultFaceId(facade));
  }, [boardName]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownFace = currentFace(faces, chosenTab);

  const details = useDetailStack(boardName);
  const detailPanels = facade.panels.filter((panel) =>
    isDetail(facade.panels, panel.id),
  );
  const stacked = (panels: FacadePanel[]) =>
    panels.filter((panel) => !isDetail(facade.panels, panel.id));
  const topId = details.opened[details.opened.length - 1];
  const shownDetail = detailPanels.find((panel) => panel.id === topId) ?? null;
  const masterOfShown = shownDetail
    ? facade.panels.find((panel) => panel.id === shownDetail.detailOf)
    : undefined;

  // A detail opened for something new starts at its top, not wherever the
  // last one was left.
  const detailScroller = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    detailScroller.current?.scrollTo?.({ top: 0 });
  }, [topId, details.openings]);

  const navigation = {
    showPanel: (id: string) => {
      // Back from a detail lands on its master, so the master's tab is the one
      // to be on — and for a panel that is no detail, its own.
      const root = rootMasterOf(facade.panels, id);
      const face = faces.find((f) => f.panels.some((p) => p.id === root));
      if (face) {
        setChosenTab(face.tab.id);
      }
      details.open(detailChain(facade.panels, id));
    },
  };

  return (
    <FacadeStateContext.Provider
      value={{ state: facadeState, setState: setFacadeStateEntry }}
    >
      <SwimlaneDragProvider>
        <FacadePanelNavigationContext.Provider value={navigation}>
        <FacadeBoardActionsProvider boardContext={boardContext}>
        {/* Draws nothing: what these have to say arrives as a toast. */}
        <FacadeNotices notices={facade.notices} boardContext={boardContext} />
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            background: "hsl(var(--background))",
            fontFamily: "'Recursive', monospace",
          }}
        >
          {/* Outside the scroller: the tabs are how a reader gets back, and a
              bar that scrolls away takes that with it. While a detail is open
              its back bar is the way back, and a tab would leave the detail
              open over a face it was not opened from. */}
          {faces.length > 0 && !shownDetail && (
            <FacadeTabBar
              tabs={faces.map((face) => face.tab)}
              active={shownFace?.tab.id ?? null}
              onSelect={setChosenTab}
            />
          )}
          <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
            {/* Hidden rather than unmounted under an open detail, and by
                visibility rather than display, so the list is still scrolled
                to the story a reader came from when they come back. */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                overflowY: "auto",
                overflowX: "hidden",
                WebkitOverflowScrolling: "touch",
                display: "flex",
                flexDirection: "column",
                visibility: shownDetail ? "hidden" : undefined,
              }}
            >
              {stacked(shared).length > 0 && (
                <PanelStack
                  panels={stacked(shared)}
                  boardContext={boardContext}
                />
              )}
              {faces.map((face) => (
                <PanelStack
                  key={face.tab.id}
                  panels={stacked(face.panels)}
                  boardContext={boardContext}
                  hidden={face.tab.id !== shownFace?.tab.id}
                />
              ))}
            </div>
            {/* Every detail stays mounted, like a hidden tab: what it reads
                is still being read while nobody is looking at it. */}
            {detailPanels.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: shownDetail ? "flex" : "none",
                  flexDirection: "column",
                  background: "hsl(var(--background))",
                }}
              >
                <DetailBar
                  title={shownDetail?.title}
                  back={masterOfShown?.title || "Back"}
                  onBack={details.back}
                />
                <div
                  ref={detailScroller}
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    overflowX: "hidden",
                    WebkitOverflowScrolling: "touch",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {detailPanels.map((panel) => (
                    <div
                      key={panel.id}
                      style={{
                        display: panel.id === shownDetail?.id ? "flex" : "none",
                        flexDirection: "column",
                      }}
                    >
                      <PanelRenderer
                        panel={panel}
                        boardContext={boardContext}
                        showTitle={false}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        </FacadeBoardActionsProvider>
        </FacadePanelNavigationContext.Provider>
      </SwimlaneDragProvider>
    </FacadeStateContext.Provider>
  );
}

/** What this view keeps in a history entry it pushed for an open detail. */
const HISTORY_KEY = "hkpFacadeDetail";

type DetailEntry = {
  board: string;
  // The details open at this entry, outermost first.
  opened: string[];
  // How many of the entries up to and including this one were pushed for
  // details, which is how far back closing all of them has to go.
  depth: number;
};

function entryIn(state: unknown, board: string): DetailEntry | null {
  const entry =
    state && typeof state === "object"
      ? (state as Record<string, unknown>)[HISTORY_KEY]
      : undefined;
  if (
    !entry ||
    typeof entry !== "object" ||
    (entry as DetailEntry).board !== board ||
    !Array.isArray((entry as DetailEntry).opened)
  ) {
    return null;
  }
  return entry as DetailEntry;
}

const sameIds = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * The details open over their masters, kept in step with the window's history.
 *
 * Opening a detail is a step a reader expects to take back with the phone's own
 * back gesture, and without an entry of its own that gesture leaves the board
 * altogether. So each opened detail pushes one — on the same address, carrying
 * whatever the router keeps there — and the stack is read back from the entry a
 * pop lands on, which is what keeps the two agreeing however far a reader goes
 * back at once.
 */
function useDetailStack(boardName: string) {
  const [opened, setOpenedRaw] = useState<string[]>([]);
  // Bumped when the open detail is opened again, which is a new thing to read
  // even though nothing in the stack changed.
  const [openings, setOpenings] = useState(0);
  const openedRef = useRef(opened);
  const setOpened = (next: string[]) => {
    openedRef.current = next;
    setOpenedRaw(next);
  };

  useEffect(() => {
    // An entry left from before a reload names a detail nothing has filled
    // since; it is dropped rather than opened empty.
    const state = window.history.state;
    if (entryIn(state, boardName)) {
      const rest = { ...(state as Record<string, unknown>) };
      delete rest[HISTORY_KEY];
      window.history.replaceState(rest, "");
    }
    setOpened([]);
    const onPop = (event: PopStateEvent) => {
      setOpened(entryIn(event.state, boardName)?.opened ?? []);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [boardName]); // eslint-disable-line react-hooks/exhaustive-deps

  const write = (next: string[], how: "push" | "replace") => {
    const state = (window.history.state ?? {}) as Record<string, unknown>;
    const depth = entryIn(state, boardName)?.depth ?? 0;
    const entry: DetailEntry = {
      board: boardName,
      opened: next,
      depth: how === "push" ? depth + 1 : depth,
    };
    const value = { ...state, [HISTORY_KEY]: entry };
    if (how === "push") {
      window.history.pushState(value, "");
    } else {
      window.history.replaceState(value, "");
    }
  };

  /** Opens the details named, outermost first; none closes them all. */
  const open = (chain: string[]) => {
    const current = openedRef.current;
    if (sameIds(current, chain)) {
      setOpenings((n) => n + 1);
      return;
    }
    if (!chain.length) {
      const depth = entryIn(window.history.state, boardName)?.depth ?? 0;
      if (depth > 0) {
        window.history.go(-depth);
      }
      setOpened([]);
      return;
    }
    if (current.every((id, i) => chain[i] === id)) {
      // Deeper along the same chain: one entry for each detail it passes.
      for (let n = current.length + 1; n <= chain.length; n++) {
        write(chain.slice(0, n), "push");
      }
    } else {
      // A different chain from inside an open detail: going back still steps
      // through what was open before, so this one takes the place of the top.
      write(chain, "replace");
    }
    setOpened(chain);
  };

  const back = () => {
    const entry = entryIn(window.history.state, boardName);
    if (entry && entry.depth > 0 && sameIds(entry.opened, openedRef.current)) {
      // The pop sets what is open, the same way the system's gesture does.
      window.history.back();
    } else {
      setOpened(openedRef.current.slice(0, -1));
    }
  };

  return { opened, openings, open, back };
}

/**
 * The strip across an open detail: the way back to its master, named, and what
 * is being read.
 */
function DetailBar({
  title,
  back,
  onBack,
}: {
  title?: string;
  back: string;
  onBack: () => void;
}) {
  const press = usePressFeedback("neutral", false);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flexShrink: 0,
        padding: "0 8px",
        borderBottom: "1px solid hsl(var(--border))",
        minHeight: 40,
      }}
    >
      <button
        {...press.handlers}
        onClick={onBack}
        aria-label={`Back to ${back}`}
        style={{
          appearance: "none",
          backgroundColor: "transparent",
          borderStyle: "none",
          padding: "9px 6px",
          cursor: "pointer",
          whiteSpace: "nowrap",
          fontFamily: "inherit",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--hkp-accent)",
          ...press.style,
        }}
      >
        ‹ {back}
      </button>
      {title && (
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 13,
            fontWeight: 600,
            color: "hsl(var(--foreground))",
          }}
        >
          {title}
        </span>
      )}
    </div>
  );
}

/**
 * Panels one under another. Kept mounted while hidden, so a tab comes back the
 * way it was left — the same bargain the desktop `PanelRow` makes.
 */
function PanelStack({
  panels,
  boardContext,
  hidden,
}: {
  panels: FacadePanel[];
  boardContext: BoardContextState;
  hidden?: boolean;
}) {
  const multiPanel = panels.length > 1;
  return (
    <div
      style={{
        display: hidden ? "none" : "flex",
        flexDirection: "column",
      }}
    >
      {panels.map((panel) => (
        <div
          key={panel.id}
          style={{
            display: "flex",
            flexDirection: "column",
            borderBottom: multiPanel
              ? "1px solid hsl(var(--border))"
              : undefined,
          }}
        >
          <PanelRenderer
            panel={panel}
            boardContext={boardContext}
            showTitle={multiPanel}
          />
        </div>
      ))}
    </div>
  );
}
