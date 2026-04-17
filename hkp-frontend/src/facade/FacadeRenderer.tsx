import React, { useState, useRef } from "react";
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
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const DEFAULT_RUNTIME_HEIGHT = Math.round(window.innerHeight * 0.4);
  const runtimeHeightKey = `hkp-facade-runtime-height-${boardName}`;
  const [runtimeHeight, setRuntimeHeight] = useState(
    () =>
      parseInt(localStorage.getItem(runtimeHeightKey) ?? "", 10) ||
      DEFAULT_RUNTIME_HEIGHT,
  );
  const dragState = useRef<{ startY: number; startHeight: number } | null>(
    null,
  );
  const runtimeHeightRef = useRef(runtimeHeight);
  runtimeHeightRef.current = runtimeHeight;

  const onDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragState.current = { startY: e.clientY, startHeight: runtimeHeight };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragState.current) {
        return;
      }
      const delta = dragState.current.startY - ev.clientY;
      const next = Math.max(
        80,
        Math.min(
          window.innerHeight - 120,
          dragState.current.startHeight + delta,
        ),
      );
      setRuntimeHeight(next);
    };
    const onMouseUp = () => {
      localStorage.setItem(runtimeHeightKey, String(runtimeHeightRef.current));
      dragState.current = null;
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
            { showEditor ? "{ live }" : "{ edit }" }
          </button>
          <button
            onClick={toggleRuntime}
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
            {showRuntime ? "{ hide board }" : "{ show board }"}
          </button>
        </div>
      </div>

      {/* Panels or editor */}
      {showEditor ? (
        <FacadeEditor facade={draftFacade} onChange={setDraftFacade} />
      ) : (
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
      )}

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
