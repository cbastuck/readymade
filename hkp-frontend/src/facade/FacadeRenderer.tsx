import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FacadeStateContext,
  StateWrite,
  recordWrite,
} from "./FacadeStateContext";
import { BindingSite } from "./bindings";
import { MAX_HISTORY } from "hkp-frontend/src/ui-components/service/flowRecords";
import { useFacadeInit } from "./useFacadeInit";
import { useFacadeIdentity } from "./FacadeIdentity";
import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { FacadeDescriptor } from "./types";
import { PanelRow } from "./panels/PanelRow";
import { FacadeEditor } from "./editor/FacadeEditor";
import { FacadeNotices } from "./FacadeNotices";
import { FacadeTabBar } from "./FacadeTabBar";
import { currentFace, defaultFaceId, resolveFaces } from "./tabs";
import { useFacadeView } from "./FacadeViewContext";
import { FacadeBoardActionsProvider } from "./FacadeBoardActions";
import { FacadePanelNavigationContext } from "./FacadePanelNavigation";
import { FacadeBindingsProvider } from "./FacadeBindingsContext";
import { FacadeBindingsBadge } from "./FacadeBindingsBadge";
import { SwimlaneDragProvider } from "./SwimlaneDragContext";

type FacadeRendererProps = {
  facade: FacadeDescriptor;
  boardContext: BoardContextState;
  boardName: string;
  runtimeContent: React.ReactNode;
};

export default function FacadeRenderer({
  facade,
  boardContext,
  boardName,
  runtimeContent,
}: FacadeRendererProps) {
  // ── facade state store ───────────────────────────────────────────────────
  const [facadeState, setFacadeStateRaw] = useState<Record<string, unknown>>(
    () => facade.state ?? {},
  );

  // What was written to each key, newest first, and by whom — so the state
  // can be read as something that happened rather than only as where it is.
  const [stateHistory, setStateHistory] = useState<
    Record<string, StateWrite[]>
  >({});

  useEffect(() => {
    setFacadeStateRaw(facade.state ?? {});
    setStateHistory({});
  }, [boardName]);

  const setFacadeStateEntry = useCallback(
    (key: string, value: unknown, writer?: BindingSite) => {
      setFacadeStateRaw((prev) => ({ ...prev, [key]: value }));
      setStateHistory((prev) =>
        recordWrite(prev, key, { at: Date.now(), value, writer }, MAX_HISTORY),
      );
    },
    [],
  );

  // Init writes as the facade, by the action's place in `init`.
  const setStateFromInit = useCallback(
    (key: string, value: unknown, step?: number) =>
      setFacadeStateEntry(
        key,
        value,
        step === undefined ? undefined : { kind: "init", index: step },
      ),
    [setFacadeStateEntry],
  );

  // Keep a ref so the init effect always sees the latest state at fire time.
  const facadeStateRef = useRef(facadeState);
  facadeStateRef.current = facadeState;
  const identity = useFacadeIdentity(boardContext);

  useFacadeInit({
    facade,
    boardContext,
    boardName,
    setState: setStateFromInit,
    stateRef: facadeStateRef,
    identity,
  });

  // Which halves are on screen is chosen from the toolbar, above this view.
  // Without a provider the facade is all there is, which is what a host that
  // offers no such controls means by mounting none.
  const view = useFacadeView();
  const showEditor = view?.editorOpen ?? false;
  const [draftFacade, setDraftFacade] = useState<FacadeDescriptor>(facade);

  // A facade with no panels in it is not something to look at, so the board
  // takes the space whatever the chosen layout says — the editor is open on a
  // board that has no facade yet, and the facade half arrives with its first
  // panel.
  const anyPanels = draftFacade.panels.length > 0;
  const showFacade = anyPanels && (view ? view.showFacade : true);
  const showRuntime = !anyPanels || (view ? view.showRuntime : false);

  // Reset the draft whenever a different board is loaded.
  useEffect(() => {
    setDraftFacade(facade);
  }, [boardName]);

  // ── tabs ─────────────────────────────────────────────────────────────────
  // Which face is chosen lives here rather than in storage: a board says what
  // it opens as, and that answer is the tab everybody uses. Editing the facade
  // can rename or drop a tab, so what is on screen is resolved against the
  // faces that exist rather than trusted.
  const { shared, faces } = resolveFaces(draftFacade);
  const [chosenTab, setChosenTab] = useState<string | null>(() =>
    defaultFaceId(facade),
  );
  useEffect(() => {
    setChosenTab(defaultFaceId(facade));
  }, [boardName]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownFace = currentFace(faces, chosenTab);

  // Panels sit side by side here, details beside their masters, so bringing
  // one on screen is choosing the tab it is on — and nothing, for a panel
  // that is on screen whichever tab is chosen.
  const navigation = {
    showPanel: (id: string) => {
      const face = faces.find((f) => f.panels.some((p) => p.id === id));
      if (face) {
        setChosenTab(face.tab.id);
      }
    },
  };

  // ── vertical (runtime) splitter ──────────────────────────────────────────
  const DEFAULT_RUNTIME_HEIGHT = Math.round(window.innerHeight * 0.4);
  const runtimeHeightKey = `hkp-facade-runtime-height-${boardName}`;
  const [runtimeHeight, setRuntimeHeight] = useState(
    () =>
      parseInt(localStorage.getItem(runtimeHeightKey) ?? "", 10) ||
      DEFAULT_RUNTIME_HEIGHT,
  );
  const runtimeDragState = useRef<{
    startY: number;
    startHeight: number;
  } | null>(null);
  const runtimeHeightRef = useRef(runtimeHeight);
  runtimeHeightRef.current = runtimeHeight;

  const onDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    runtimeDragState.current = {
      startY: e.clientY,
      startHeight: runtimeHeight,
    };

    const onMouseMove = (ev: MouseEvent) => {
      if (!runtimeDragState.current) {
        return;
      }
      const delta = runtimeDragState.current.startY - ev.clientY;
      const next = Math.max(
        80,
        Math.min(
          window.innerHeight - 120,
          runtimeDragState.current.startHeight + delta,
        ),
      );
      setRuntimeHeight(next);
    };
    const onMouseUp = () => {
      localStorage.setItem(runtimeHeightKey, String(runtimeHeightRef.current));
      runtimeDragState.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // ── horizontal (editor) splitter ─────────────────────────────────────────
  const DEFAULT_EDITOR_WIDTH = 380;
  const editorWidthKey = `hkp-facade-editor-width-${boardName}`;
  const [editorWidth, setEditorWidth] = useState(
    () =>
      parseInt(localStorage.getItem(editorWidthKey) ?? "", 10) ||
      DEFAULT_EDITOR_WIDTH,
  );
  const editorDragState = useRef<{ startX: number; startWidth: number } | null>(
    null,
  );
  const editorWidthRef = useRef(editorWidth);
  editorWidthRef.current = editorWidth;

  const onEditorDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    editorDragState.current = { startX: e.clientX, startWidth: editorWidth };

    const onMouseMove = (ev: MouseEvent) => {
      if (!editorDragState.current) {
        return;
      }
      // Divider is on the left edge of the editor panel, so dragging left widens it.
      const delta = editorDragState.current.startX - ev.clientX;
      const next = Math.max(
        200,
        Math.min(
          window.innerWidth - 200,
          editorDragState.current.startWidth + delta,
        ),
      );
      setEditorWidth(next);
    };
    const onMouseUp = () => {
      localStorage.setItem(editorWidthKey, String(editorWidthRef.current));
      editorDragState.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <FacadeStateContext.Provider
      value={{
        state: facadeState,
        setState: setFacadeStateEntry,
        history: stateHistory,
      }}
    >
      <SwimlaneDragProvider>
        <FacadePanelNavigationContext.Provider value={navigation}>
        <FacadeBindingsProvider
          facade={draftFacade}
          boardContext={boardContext}
          // Only with the board beside it: a binding points at the board, and
          // a host with no view controls is showing the facade as an app.
          badges={!!view && showFacade && showRuntime}
        >
        <FacadeBoardActionsProvider boardContext={boardContext}>
        {/* Draws nothing: what these have to say arrives as a toast. */}
        <FacadeNotices
          notices={draftFacade.notices}
          boardContext={boardContext}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            background: "hsl(var(--background))",
            overflow: "hidden",
            fontFamily: "'Recursive', monospace",
          }}
        >
          {/* The board, with the editor alongside it */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
              display: "flex",
              flexDirection: "row",
            }}
          >
            {/* Facade above board, in whichever proportion is on screen */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Live facade — kept mounted while hidden so its widgets hold state */}
              <div
                style={{
                  flex: showFacade ? 1 : "0 0 0px",
                  minHeight: 0,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Panels no tab claims, on screen whichever tab is chosen.
                    Every panel, for a facade with no tabs at all. */}
                {shared.length > 0 && (
                  <PanelRow
                    panels={shared}
                    boardContext={boardContext}
                    widthsKey={boardName}
                  />
                )}
                {faces.length > 0 && (
                  <FacadeTabBar
                    tabs={faces.map((face) => face.tab)}
                    active={shownFace?.tab.id ?? null}
                    onSelect={setChosenTab}
                  />
                )}
                {faces.map((face) => (
                  <PanelRow
                    key={face.tab.id}
                    panels={face.panels}
                    boardContext={boardContext}
                    widthsKey={`${boardName}#${face.tab.id}`}
                    hidden={face.tab.id !== shownFace?.tab.id}
                  />
                ))}
              </div>

              {/* Draggable divider + runtime drawer — always mounted so service UIs stay alive */}
              <div
                onMouseDown={
                  showRuntime && showFacade ? onDividerMouseDown : undefined
                }
                style={{
                  height: showRuntime ? 6 : 0,
                  cursor: showRuntime && showFacade ? "ns-resize" : undefined,
                  background: "hsl(var(--border))",
                  flexShrink: 0,
                  userSelect: "none",
                  // The facade's own badge sits on it, where the facade meets
                  // the board.
                  position: "relative",
                  zIndex: 6,
                }}
              >
                {showRuntime && showFacade && <FacadeBindingsBadge />}
              </div>
              <div
                style={{
                  height: !showRuntime
                    ? 0
                    : showFacade
                      ? runtimeHeight
                      : "auto",
                  // Longhand: a changing `flex` would reset the flexShrink
                  // beside it, which React does not write again.
                  flexGrow: showRuntime && !showFacade ? 1 : 0,
                  flexBasis: showRuntime && !showFacade ? "0%" : "auto",
                  minHeight: 0,
                  background: "hsl(var(--muted))",
                  flexShrink: 0,
                  overflow: showRuntime ? "auto" : "hidden",
                }}
              >
                {runtimeContent}
              </div>
            </div>

            {/* Horizontal splitter + editor panel */}
            {showEditor && (
              <>
                <div
                  onMouseDown={onEditorDividerMouseDown}
                  style={{
                    width: 6,
                    flexShrink: 0,
                    cursor: "ew-resize",
                    background: "hsl(var(--border))",
                    userSelect: "none",
                  }}
                />
                <div
                  style={{
                    width: editorWidth,
                    flexShrink: 0,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <FacadeEditor
                    facade={draftFacade}
                    onChange={setDraftFacade}
                  />
                </div>
              </>
            )}
          </div>
        </div>
        </FacadeBoardActionsProvider>
        </FacadeBindingsProvider>
        </FacadePanelNavigationContext.Provider>
      </SwimlaneDragProvider>
    </FacadeStateContext.Provider>
  );
}
