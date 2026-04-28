import React, { useState, useRef, useEffect } from "react";
import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { FacadeDescriptor } from "./types";
import { PanelRenderer } from "./panels/PanelRenderer";
import { FacadeEditor } from "./editor/FacadeEditor";
import ShareQRCodeDialog from "hkp-frontend/src/components/ShareQRCodeDialog";
import { createBoardLink } from "hkp-frontend/src/views/playground/BoardLink";
import {
  isLocalhostUrl,
  resolveTemplateVarsInObject,
} from "hkp-frontend/src/templateVars";

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
  const storageKey = `hkp-facade-runtime-${boardName}`;
  const [showRuntime, setShowRuntime] = useState(
    () => localStorage.getItem(storageKey) === "true",
  );
  const [showEditor, setShowEditor] = useState(false);
  const [draftFacade, setDraftFacade] = useState<FacadeDescriptor>(facade);

  // Reset the draft whenever a different board is loaded.
  useEffect(() => {
    setDraftFacade(facade);
  }, [boardName]);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  // ── vertical (runtime) splitter ──────────────────────────────────────────
  const DEFAULT_RUNTIME_HEIGHT = Math.round(window.innerHeight * 0.4);
  const runtimeHeightKey = `hkp-facade-runtime-height-${boardName}`;
  const [runtimeHeight, setRuntimeHeight] = useState(
    () =>
      parseInt(localStorage.getItem(runtimeHeightKey) ?? "", 10) ||
      DEFAULT_RUNTIME_HEIGHT,
  );
  const runtimeDragState = useRef<{ startY: number; startHeight: number } | null>(null);
  const runtimeHeightRef = useRef(runtimeHeight);
  runtimeHeightRef.current = runtimeHeight;

  const onDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    runtimeDragState.current = { startY: e.clientY, startHeight: runtimeHeight };

    const onMouseMove = (ev: MouseEvent) => {
      if (!runtimeDragState.current) { return; }
      const delta = runtimeDragState.current.startY - ev.clientY;
      const next = Math.max(
        80,
        Math.min(window.innerHeight - 120, runtimeDragState.current.startHeight + delta),
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
  const editorDragState = useRef<{ startX: number; startWidth: number } | null>(null);
  const editorWidthRef = useRef(editorWidth);
  editorWidthRef.current = editorWidth;

  const onEditorDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    editorDragState.current = { startX: e.clientX, startWidth: editorWidth };

    const onMouseMove = (ev: MouseEvent) => {
      if (!editorDragState.current) { return; }
      // Divider is on the left edge of the editor panel, so dragging left widens it.
      const delta = editorDragState.current.startX - ev.clientX;
      const next = Math.max(200, Math.min(window.innerWidth - 200, editorDragState.current.startWidth + delta));
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

  const toggleRuntime = () => {
    setShowRuntime((prev) => {
      const next = !prev;
      localStorage.setItem(storageKey, String(next));
      return next;
    });
  };

  const openShareQR = async () => {
    const data = await boardContext.serializeBoard();
    if (!data) {
      return;
    }

    // Exclude runtimes whose URL resolves to localhost — those are specific to
    // the originator's machine and will fail on the partner's. Runtimes at a
    // public or LAN address are kept because both parties can reach them.
    const partnerRuntimeIds = new Set(
      data.runtimes
        .filter((rt) => !isLocalhostUrl((rt as any).url))
        .map((rt) => rt.id),
    );
    const partnerRuntimes = data.runtimes.filter((rt) =>
      partnerRuntimeIds.has(rt.id),
    );

    // Swap peerName / targetPeer on peer-socket services so the partner
    // board connects back to the originator rather than to itself.
    const partnerServices: typeof data.services = {};
    for (const [runtimeId, svcs] of Object.entries(data.services)) {
      if (!partnerRuntimeIds.has(runtimeId)) {
        continue;
      }
      partnerServices[runtimeId] = svcs.map((svc) => {
        if (svc.serviceId !== "hookup.to/service/peer-socket") {
          return svc;
        }
        const { peerName, targetPeer, ...rest } = svc.state as any;
        return {
          ...svc,
          state: { ...rest, peerName: targetPeer, targetPeer: peerName },
        };
      });
    }

    const resolved = resolveTemplateVarsInObject({
      runtimes: partnerRuntimes,
      services: partnerServices,
      facade: draftFacade,
    });
    const url = createBoardLink(JSON.stringify(resolved));
    setShareUrl(url);
  };

  const multiPanel = draftFacade.panels.length > 1;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "hsl(var(--background))",
        overflow: "hidden",
        fontFamily: "'Recursive', monospace",
        paddingBottom: "8px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "10px 16px",
          borderBottom: "1px solid hsl(var(--border))",
          background: "hsl(var(--card))",
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 15 }}>{boardName}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button
            onClick={openShareQR}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid hsl(var(--border))",
              background: "transparent",
              color: "hsl(var(--muted-foreground))",
              cursor: "pointer",
              fontSize: 11,
              fontFamily: "monospace",
            }}
          >
            QR
          </button>
          <button
            onClick={() => setShowEditor((v) => !v)}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid hsl(var(--border))",
              background: showEditor ? "hsl(var(--accent))" : "transparent",
              color: showEditor
                ? "hsl(var(--accent-foreground))"
                : "hsl(var(--muted-foreground))",
              cursor: "pointer",
              fontSize: 11,
              fontFamily: "monospace",
            }}
          >
            {showEditor ? "{ hide editor }" : "{ editor }"}
          </button>
          <button
            onClick={toggleRuntime}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid hsl(var(--border))",
              background: showRuntime ? "hsl(var(--accent))" : "transparent",
              color: showRuntime
                ? "hsl(var(--accent-foreground))"
                : "hsl(var(--muted-foreground))",
              cursor: "pointer",
              fontSize: 11,
              fontFamily: "monospace",
            }}
          >
            {showRuntime ? "{ hide board }" : "{ show board }"}
          </button>
        </div>
      </div>

      {/* Live panels + optional editor side-by-side */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "row" }}>
        {/* Live facade */}
        <div
          style={{
            flex: 1,
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

      {/* Draggable divider + runtime drawer — always mounted so service UIs stay alive */}
      <div
        onMouseDown={showRuntime ? onDividerMouseDown : undefined}
        style={{
          height: showRuntime ? 6 : 0,
          cursor: showRuntime ? "ns-resize" : undefined,
          background: "hsl(var(--border))",
          flexShrink: 0,
          userSelect: "none",
        }}
      />
      <div
        style={{
          height: showRuntime ? runtimeHeight : 0,
          minHeight: 0,
          background: "hsl(var(--muted))",
          overflowY: "auto",
          flexShrink: 0,
          overflow: showRuntime ? "auto" : "hidden",
        }}
      >
        {runtimeContent}
      </div>

      <ShareQRCodeDialog
        title="Share board"
        isOpen={shareUrl !== null}
        url={shareUrl}
        onClose={() => setShareUrl(null)}
      />
    </div>
  );
}
