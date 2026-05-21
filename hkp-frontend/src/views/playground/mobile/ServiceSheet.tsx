import { useEffect, useRef, useState } from "react";
import BottomSheet from "./BottomSheet";
import JsonEditor from "./JsonEditor";
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
import {
  getServiceConfig as getBrowserServiceConfig,
  configureService as configureBrowserService,
} from "../../../runtime/browser/BrowserRuntimeApi";
import { makeServiceInstance as makeRestInstance } from "../../../runtime/rest/RuntimeRest";
import { findServiceUI as findRestServiceUI } from "../../../runtime/rest/UIRegistry";
import RuntimeRestServiceUI from "../../../runtime/rest/RuntimeRestServiceUI";
import {
  getServiceConfig as getRestServiceConfig,
  configureService as configureRestService,
} from "../../../runtime/rest/RuntimeRestApi";
import { makeServiceInstance as makeGraphQLInstance } from "../../../runtime/graphql/RuntimeGraphQL";
import { findServiceUI as findGraphQLServiceUI } from "../../../runtime/graphql/UIRegistry";
import RuntimeGraphQLServiceUI from "../../../runtime/graphql/RuntimeGraphQLServiceUI";
import {
  getServiceConfig as getGraphQLServiceConfig,
  configureService as configureGraphQLService,
} from "../../../runtime/graphql/RuntimeGraphQLApi";

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
  const [configExpanded, setConfigExpanded] = useState(false);
  const [configDraft, setConfigDraft] = useState<any>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const configReturnTo = useRef<"ui" | "root">("root");
  const [zoomLevel, setZoomLevel] = useState(loadZoom);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);
  const zoomRef = useRef(zoomLevel);
  zoomRef.current = zoomLevel;

  useEffect(() => {
    if (!open) {
      setUiExpanded(false);
      setConfigExpanded(false);
      setEditingName(false);
      setConfigError(null);
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

  const openConfig = async () => {
    if (!boardContext || !service || !runtime) { return; }
    configReturnTo.current = uiExpanded ? "ui" : "root";
    const scope = boardContext.scopes[runtime.id];
    let config: any = {};
    try {
      if (isRuntimeBrowserClassType(runtime.type) && scope) {
        config = await getBrowserServiceConfig(scope, service);
      } else if (isRuntimeRestClassType(runtime.type) && scope) {
        config = await getRestServiceConfig(scope, service);
      } else if (isRuntimeGraphQLClassType(runtime.type) && scope) {
        config = await getGraphQLServiceConfig(scope, service);
      } else {
        config = service.state ?? {};
      }
    } catch {
      config = service.state ?? {};
    }
    setConfigDraft(config);
    setConfigError(null);
    setConfigExpanded(true);
  };

  const applyConfig = async () => {
    if (!boardContext || !service || !runtime) { return; }
    const scope = boardContext.scopes[runtime.id];
    if (!scope) {
      setConfigError("Runtime not initialized");
      return;
    }
    setConfigSaving(true);
    setConfigError(null);
    try {
      if (isRuntimeBrowserClassType(runtime.type)) {
        await configureBrowserService(scope, service, configDraft);
      } else if (isRuntimeRestClassType(runtime.type)) {
        await configureRestService(scope, service, configDraft);
      } else if (isRuntimeGraphQLClassType(runtime.type)) {
        await configureGraphQLService(scope, service, configDraft);
      }
      setConfigExpanded(false);
      if (configReturnTo.current === "ui") {
        setUiExpanded(true);
      }
    } catch (e: any) {
      setConfigError(`Failed to apply: ${e.message}`);
    } finally {
      setConfigSaving(false);
    }
  };

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
      height={uiExpanded || configExpanded ? "92%" : "60%"}
    >
      {configExpanded ? (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {/* Config toolbar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => setConfigExpanded(false)}
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
            <div style={{ flex: 1 }} />
            <button
              onClick={applyConfig}
              disabled={configSaving}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "6px 14px",
                border: "none",
                borderRadius: 8,
                background: configSaving ? M.tealLight : M.teal,
                color: configSaving ? M.tealDark : "#fff",
                cursor: configSaving ? "default" : "pointer",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "inherit",
              }}
            >
              <MobileIcon name="check" size={13} color={configSaving ? M.tealDark : "#fff"} />
              {configSaving ? "Applying…" : "Apply"}
            </button>
          </div>

          {/* Error */}
          {configError && (
            <div
              style={{
                marginBottom: 8,
                padding: "8px 12px",
                background: "#fff5f5",
                border: `1px solid ${M.danger}`,
                borderRadius: 8,
                fontSize: 12,
                color: M.danger,
                flexShrink: 0,
              }}
            >
              {configError}
            </div>
          )}

          {/* JSON editor */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <JsonEditor
              value={configDraft}
              onChange={setConfigDraft}
              rootLabel={service?.serviceId ?? "root"}
            />
          </div>
        </div>
      ) : uiExpanded ? (
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

          {/* Configure button */}
          <div style={{ flexShrink: 0, paddingTop: 8 }}>
            <button
              onClick={() => { setUiExpanded(false); openConfig(); }}
              style={{
                width: "100%",
                height: 40,
                border: `1.5px solid ${M.teal}`,
                borderRadius: 10,
                background: M.tealLight,
                color: M.tealDark,
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <MobileIcon name="settings" size={14} color={M.tealDark} />
              Configure
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: 20 }}
          onFocus={() => !nameValue && setNameValue(service.serviceName)}
        >
          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setUiExpanded(true)}
              style={{
                flex: 1,
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
              Service UI
            </button>
            <button
              onClick={openConfig}
              style={{
                flex: 1,
                height: 46,
                border: `1.5px solid ${M.teal}`,
                borderRadius: 12,
                background: M.tealLight,
                color: M.tealDark,
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
              <MobileIcon name="settings" size={16} color={M.tealDark} />
              Configure
            </button>
          </div>

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
