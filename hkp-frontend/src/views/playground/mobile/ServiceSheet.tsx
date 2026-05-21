import { useEffect, useRef, useState } from "react";
import BottomSheet from "./BottomSheet";
import MobileIcon from "./MobileIcon";
import { M, SERVICE_UI_ZOOM } from "./tokens";
import {
  ServiceAction,
  ServiceDescriptor,
  RuntimeDescriptor,
  isRuntimeBrowserClassType,
  isRuntimeRestClassType,
  isRuntimeGraphQLClassType,
} from "../../../types";
import { useBoardContext } from "../../../BoardContext";
import BrowserRuntimeScope from "../../../runtime/browser/BrowserRuntimeScope";
import { findServiceUI as findBrowserServiceUI } from "../../../runtime/browser/UIRegistry";
import { makeServiceInstance as makeRestInstance } from "../../../runtime/rest/RuntimeRest";
import { findServiceUI as findRestServiceUI } from "../../../runtime/rest/UIRegistry";
import RuntimeRestServiceUI from "../../../runtime/rest/RuntimeRestServiceUI";
import { makeServiceInstance as makeGraphQLInstance } from "../../../runtime/graphql/RuntimeGraphQL";
import { findServiceUI as findGraphQLServiceUI } from "../../../runtime/graphql/UIRegistry";
import RuntimeGraphQLServiceUI from "../../../runtime/graphql/RuntimeGraphQLServiceUI";

function NotAvailable({ reason }: { reason: string }) {
  return (
    <div
      style={{
        padding: 24,
        fontSize: 14,
        color: M.textMuted,
        textAlign: "center",
      }}
    >
      {reason}
    </div>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  service: ServiceDescriptor | null;
  runtime: RuntimeDescriptor | null;
  onRemove: (service: ServiceDescriptor, runtime: RuntimeDescriptor) => void;
  onRename: (runtimeId: string, instanceId: string, name: string) => void;
};

const ZOOM_STORAGE_KEY = "hkp-service-ui-zoom";

function loadZoom(): number {
  try {
    const v = localStorage.getItem(ZOOM_STORAGE_KEY);
    if (v !== null) {
      return Math.min(2.5, Math.max(0.5, Number(v)));
    }
  } catch {}
  return SERVICE_UI_ZOOM;
}

export default function ServiceSheet({
  open,
  onClose,
  service,
  runtime,
  onRemove,
  onRename,
}: Props) {
  const boardContext = useBoardContext();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [uiExpanded, setUiExpanded] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(loadZoom);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);
  const zoomRef = useRef(zoomLevel);
  zoomRef.current = zoomLevel;

  useEffect(() => {
    if (!open) {
      setUiExpanded(false);
      setEditingName(false);
    }
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) { return; }

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchRef.current = { startDist: Math.hypot(dx, dy), startZoom: zoomRef.current };
      }
    };

    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchRef.current) { return; }
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const next = Math.min(2.5, Math.max(0.5, pinchRef.current.startZoom * (dist / pinchRef.current.startDist)));
      setZoomLevel(next);
      try { localStorage.setItem(ZOOM_STORAGE_KEY, String(next)); } catch {}
    };

    const onEnd = () => { pinchRef.current = null; };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [uiExpanded]);

  const handleNameSubmit = () => {
    if (service && runtime && nameValue.trim()) {
      onRename(runtime.id, service.uuid, nameValue.trim());
    }
    setEditingName(false);
  };

  if (!service || !runtime) {
    return null;
  }

  const renderServiceUI = () => {
    if (!boardContext) {
      return <NotAvailable reason="Service UI not available" />;
    }

    const scope = boardContext.scopes[runtime.id];
    const { boardName } = boardContext;

    const handleServiceAction = (cmd: ServiceAction) => {
      if (cmd.action === "remove") {
        boardContext.removeService({ uuid: cmd.service.uuid }, runtime);
        onClose();
      } else if (cmd.action === "rename" && cmd.payload) {
        boardContext.setServiceName(runtime.id, cmd.service.uuid, cmd.payload);
      }
    };

    if (isRuntimeBrowserClassType(runtime.type)) {
      const browserScope = scope as BrowserRuntimeScope | undefined;
      const instance =
        browserScope?.findServiceInstance(service.uuid)?.[0] ?? null;
      const UI = instance
        ? (findBrowserServiceUI(service.serviceId) ??
          browserScope?.registry.findServiceModule(service.serviceId)
            ?.createUI ??
          null)
        : null;
      if (!UI || !instance) {
        return (
          <NotAvailable
            reason={
              scope ? "Service UI not available" : "Runtime not yet initialized"
            }
          />
        );
      }
      return (
        <UI
          service={instance}
          showBypassOnlyIfExplicit={false}
          draggable={false}
          onServiceAction={handleServiceAction}
        />
      );
    }

    if (isRuntimeRestClassType(runtime.type)) {
      if (!scope) {
        return <NotAvailable reason="Runtime not yet initialized" />;
      }
      const instance = makeRestInstance(scope, service, boardName ?? "");
      const UI =
        findRestServiceUI({
          serviceId: service.serviceId,
          version: service.version,
          capabilities: service.capabilities,
        }) ?? RuntimeRestServiceUI;
      return (
        <UI
          service={instance}
          showBypassOnlyIfExplicit={true}
          draggable={false}
          onServiceAction={handleServiceAction}
        />
      );
    }

    if (isRuntimeGraphQLClassType(runtime.type)) {
      if (!scope) {
        return <NotAvailable reason="Runtime not yet initialized" />;
      }
      const instance = makeGraphQLInstance(scope, service, boardName ?? "");
      const UI =
        findGraphQLServiceUI(service.serviceId) ?? RuntimeGraphQLServiceUI;
      return (
        <UI
          service={instance}
          showBypassOnlyIfExplicit={true}
          draggable={false}
          onServiceAction={handleServiceAction}
        />
      );
    }

    return (
      <NotAvailable reason="Service UI not available for this runtime type" />
    );
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={service.serviceName}
      height={uiExpanded ? "92%" : "60%"}
    >
      {uiExpanded ? (
        <div
          style={{ display: "flex", flexDirection: "column", height: "100%" }}
        >
          {/* Expanded toolbar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 12,
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => setUiExpanded(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "6px 10px",
                border: `1px solid ${M.border}`,
                borderRadius: 8,
                background: M.card,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 500,
                color: M.textSecondary,
                fontFamily: "inherit",
              }}
            >
              <MobileIcon name="minimize2" size={13} color={M.textSecondary} />
              Collapse
            </button>
            <span style={{ fontSize: 11, color: M.textMuted, fontVariantNumeric: "tabular-nums" }}>
              {Math.round(zoomLevel * 100)}%
            </span>
          </div>

          {/* Service UI */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: "auto",
              overflowX: "auto",
              WebkitOverflowScrolling: "touch" as never,
            }}
          >
            <div
              style={{
                zoom: zoomLevel,
                width: `calc(100% / ${zoomLevel})`,
              }}
            >
              {renderServiceUI()}
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: 20 }}
          onFocus={() => !nameValue && setNameValue(service.serviceName)}
        >
          {/* Show Service UI button */}
          <button
            onClick={() => setUiExpanded(true)}
            style={{
              height: 46,
              border: "none",
              borderRadius: 12,
              background: M.teal,
              color: "#fff",
              fontFamily: "inherit",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <MobileIcon name="maximize2" size={16} color="#fff" />
            Show Service UI
          </button>

          {/* Name row */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                color: M.textMuted,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Name
            </div>
            {editingName ? (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  autoFocus
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleNameSubmit();
                    }
                    if (e.key === "Escape") {
                      setEditingName(false);
                    }
                  }}
                  style={{
                    flex: 1,
                    height: 44,
                    border: `1.5px solid ${M.teal}`,
                    borderRadius: 10,
                    padding: "0 12px",
                    fontFamily: "inherit",
                    fontSize: 15,
                    color: M.textPrimary,
                    background: M.card,
                    outline: "none",
                  }}
                />
                <button
                  onClick={handleNameSubmit}
                  style={{
                    width: 44,
                    height: 44,
                    border: "none",
                    borderRadius: 10,
                    background: M.teal,
                    color: "#fff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MobileIcon name="check" size={18} color="#fff" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setNameValue(service.serviceName);
                  setEditingName(true);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "12px 14px",
                  background: "#f8f5f2",
                  border: `1px solid ${M.border}`,
                  borderRadius: 10,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ flex: 1, fontSize: 15, color: M.textPrimary }}>
                  {service.serviceName}
                </span>
                <MobileIcon name="chevronRight" size={14} color={M.textMuted} />
              </button>
            )}
          </div>

          {/* Service ID */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                color: M.textMuted,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Service ID
            </div>
            <div
              style={{
                padding: "10px 14px",
                background: "#f8f5f2",
                borderRadius: 10,
                border: `1px solid ${M.border}`,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: M.textSecondary,
                  fontFamily: "monospace",
                  wordBreak: "break-all",
                }}
              >
                {service.serviceId}
              </span>
            </div>
          </div>

          {/* Runtime */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                color: M.textMuted,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Runtime
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                background: M.blueLight,
                border: `1px solid ${M.runtimeBorder}`,
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: M.blue,
                }}
              />
              <span style={{ fontSize: 14, color: M.textPrimary }}>
                {runtime.name}
              </span>
            </div>
          </div>

          {/* State preview */}
          {service.state !== undefined && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  color: M.textMuted,
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Current State
              </div>
              <div
                style={{
                  padding: "10px 14px",
                  background: "#f8f5f2",
                  borderRadius: 10,
                  border: `1px solid ${M.border}`,
                  maxHeight: 120,
                  overflowY: "auto",
                }}
              >
                <pre
                  style={{
                    fontSize: 11,
                    color: M.textSecondary,
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}
                >
                  {JSON.stringify(service.state, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Remove */}
          <button
            onClick={() => {
              onRemove(service, runtime);
              onClose();
            }}
            style={{
              height: 46,
              border: `1.5px solid ${M.danger}`,
              borderRadius: 12,
              background: "#fff5f5",
              color: M.danger,
              fontFamily: "inherit",
              fontSize: 15,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginTop: 4,
            }}
          >
            <MobileIcon name="trash" size={16} color={M.danger} />
            Remove Service
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
