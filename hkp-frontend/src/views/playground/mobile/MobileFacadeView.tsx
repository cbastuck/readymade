import { useCallback, useEffect, useRef, useState } from "react";

import { BoardContextState } from "../../../BoardContext";
import { FacadeStateContext } from "../../../facade/FacadeStateContext";
import { FacadeBoardActionsProvider } from "../../../facade/FacadeBoardActions";
import { FacadeNotices } from "../../../facade/FacadeNotices";
import { FacadeTabBar } from "../../../facade/FacadeTabBar";
import { executeActions } from "../../../facade/executeActions";
import { PanelRenderer } from "../../../facade/panels/PanelRenderer";
import { currentFace, defaultFaceId, resolveFaces } from "../../../facade/tabs";
import { FacadeDescriptor, FacadePanel } from "../../../facade/types";

/**
 * Touch-friendly facade renderer for the mobile board view. Mirrors the core of
 * the desktop `FacadeRenderer` (facade state store, `facade.init`, tabs,
 * notices, panel rendering) without its mouse-driven splitters / side-by-side
 * editor. Panels stack vertically and scroll.
 *
 * Tabs matter more here than on the desktop, not less: a phone shows one panel's
 * worth of screen, so a facade that puts its setting-up controls in the way
 * costs a reader the whole view rather than a column of it.
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

  useEffect(() => {
    if (!facade.init?.length) {
      return;
    }
    void executeActions({
      actions: facade.init,
      value: undefined,
      boardContext,
      setState: setFacadeStateEntry,
      state: facadeStateRef.current,
    });
  }, [boardName]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <FacadeStateContext.Provider
      value={{ state: facadeState, setState: setFacadeStateEntry }}
    >
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
              bar that scrolls away takes that with it. */}
          {faces.length > 0 && (
            <FacadeTabBar
              tabs={faces.map((face) => face.tab)}
              active={shownFace?.tab.id ?? null}
              onSelect={setChosenTab}
            />
          )}
          <div
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
            {shared.length > 0 && (
              <PanelStack panels={shared} boardContext={boardContext} />
            )}
            {faces.map((face) => (
              <PanelStack
                key={face.tab.id}
                panels={face.panels}
                boardContext={boardContext}
                hidden={face.tab.id !== shownFace?.tab.id}
              />
            ))}
          </div>
        </div>
      </FacadeBoardActionsProvider>
    </FacadeStateContext.Provider>
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
