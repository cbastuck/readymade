import React, { useState, useRef, useEffect, useCallback } from "react";
import { FacadeStateContext } from "./FacadeStateContext";
import { executeActions } from "./executeActions";
import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { FacadeDescriptor } from "./types";
import { PanelRenderer } from "./panels/PanelRenderer";
import { FacadeEditor } from "./editor/FacadeEditor";
import { useFacadeView } from "./FacadeViewContext";

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
    executeActions({
      actions: facade.init,
      value: undefined,
      boardContext,
      setState: setFacadeStateEntry,
      state: facadeStateRef.current,
    });
  }, [boardName]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const multiPanel = draftFacade.panels.length > 1;

  return (
    <FacadeStateContext.Provider
      value={{ state: facadeState, setState: setFacadeStateEntry }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          background: "hsl(var(--background))",
          overflow: "hidden",
          fontFamily: "'Recursive', monospace",
          paddingBottom: "36px",
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
                flexDirection: multiPanel ? "row" : "column",
              }}
            >
              {draftFacade.panels.map((panel, idx) => (
                <div
                  key={panel.id}
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    borderLeft:
                      multiPanel && idx > 0
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
              }}
            />
            <div
              style={{
                height: !showRuntime ? 0 : showFacade ? runtimeHeight : "auto",
                flex: showRuntime && !showFacade ? 1 : undefined,
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
                <FacadeEditor facade={draftFacade} onChange={setDraftFacade} />
              </div>
            </>
          )}
        </div>
      </div>
    </FacadeStateContext.Provider>
  );
}
