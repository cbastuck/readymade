import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BottomSheet from "./BottomSheet";
import JsonEditor from "./JsonEditor";
import MobileIcon from "./MobileIcon";
import MobileSubPipeline, { PipelineEntry } from "./MobileSubPipeline";
import AddServiceSheet from "./AddServiceSheet";
import { M, SERVICE_UI_ZOOM } from "./tokens";
import {
  ServiceAction,
  ServiceClass,
  ServiceDescriptor,
  ServiceInstance,
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

// One breadcrumb level past the top-level service.
type Crumb = { instanceId: string; serviceId: string; serviceName: string };

const ZOOM_STORAGE_KEY = "hkp-service-ui-zoom";

const SUBSERVICES_CAP = "subservices";

function hasSubservices(caps: string[] | undefined): boolean {
  return (caps ?? []).some(
    (c) => c.trim().toLowerCase() === SUBSERVICES_CAP,
  );
}

function loadZoom(): number {
  try {
    const v = localStorage.getItem(ZOOM_STORAGE_KEY);
    if (v !== null) {
      return Math.min(2.5, Math.max(0.5, Number(v)));
    }
  } catch {
    // ignore unavailable / blocked localStorage
  }
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

  // ── Nested-pipeline navigation ───────────────────────────────
  // `rootState` is the live state of the top-level service (it contains the
  // whole nested pipeline tree). `path` is the breadcrumb trail of sub-services
  // we've drilled into. The "active" node is resolved by walking the tree.
  const [rootState, setRootState] = useState<any>(null);
  const [path, setPath] = useState<Crumb[]>([]);
  const [addPickerOpen, setAddPickerOpen] = useState(false);

  const scope = runtime ? boardContext?.scopes[runtime.id] : undefined;
  const boardName = boardContext?.boardName ?? "";
  const subRegistry: ServiceClass[] = useMemo(
    () =>
      runtime && boardContext ? (boardContext.registry[runtime.id] ?? []) : [],
    [runtime, boardContext],
  );

  const capsOf = useCallback(
    (serviceId: string): string[] =>
      subRegistry.find((s) => s.serviceId === serviceId)?.capabilities ?? [],
    [subRegistry],
  );

  const rootCaps = service?.capabilities ?? capsOf(service?.serviceId ?? "");
  const rootHasSub = hasSubservices(rootCaps);

  const refreshRoot = useCallback(async () => {
    if (!boardContext || !service || !runtime) {
      return;
    }
    const sc = boardContext.scopes[runtime.id];
    try {
      let cfg: any = {};
      if (isRuntimeBrowserClassType(runtime.type) && sc) {
        cfg = await getBrowserServiceConfig(sc, service);
      } else if (isRuntimeRestClassType(runtime.type) && sc) {
        cfg = await getRestServiceConfig(sc, service);
      } else if (isRuntimeGraphQLClassType(runtime.type) && sc) {
        cfg = await getGraphQLServiceConfig(sc, service);
      } else {
        cfg = service.state ?? {};
      }
      setRootState(cfg);
    } catch {
      setRootState(service.state ?? {});
    }
  }, [boardContext, service, runtime]);

  // Reset transient UI on close; reset the drill path when the service changes.
  useEffect(() => {
    if (!open) {
      setUiExpanded(false);
      setConfigExpanded(false);
      setEditingName(false);
      setConfigError(null);
      setPath([]);
      setRootState(null);
      setAddPickerOpen(false);
    }
  }, [open]);

  useEffect(() => {
    setPath([]);
  }, [service?.uuid]);

  // Load the root state once when opening a subservices-capable service.
  useEffect(() => {
    if (open && rootHasSub) {
      refreshRoot();
    }
  }, [open, rootHasSub, refreshRoot]);

  // ── Resolve the active node by walking rootState along `path` ──
  const active = useMemo(() => {
    let state: any = rootState ?? service?.state ?? {};
    let serviceId = service?.serviceId ?? "";
    let serviceName = service?.serviceName ?? "";
    let instanceId = service?.uuid ?? "";
    let validDepth = 0;
    for (const crumb of path) {
      const pipeline: PipelineEntry[] = state?.pipeline ?? [];
      const entry = pipeline.find((e) => e.instanceId === crumb.instanceId);
      if (!entry) {
        break;
      }
      state = entry.state ?? {};
      serviceId = entry.serviceId;
      serviceName = crumb.serviceName || entry.serviceId;
      instanceId = entry.instanceId;
      validDepth += 1;
    }
    return { state, serviceId, serviceName, instanceId, validDepth };
  }, [rootState, service, path]);

  // Prune the path if a level vanished (e.g. removed elsewhere).
  useEffect(() => {
    if (active.validDepth < path.length) {
      setPath((p) => p.slice(0, active.validDepth));
    }
  }, [active.validDepth, path.length]);

  const isRoot = path.length === 0;
  const activeCaps = isRoot ? rootCaps : capsOf(active.serviceId);
  const activeHasSub = hasSubservices(activeCaps);
  const activePipeline: PipelineEntry[] = active.state?.pipeline ?? [];
  const pathIds = useMemo(() => path.map((c) => c.instanceId), [path]);

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
      try { localStorage.setItem(ZOOM_STORAGE_KEY, String(next)); } catch { /* ignore */ }
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

  // ── Configure delivery, with nesting for deep sub-services ─────
  // A payload aimed at the active node is wrapped in one `configureService`
  // envelope per breadcrumb level, then sent to the top-level service.
  const wrapForPath = (payload: any, ids: string[]): any =>
    ids.reduceRight(
      (acc, id) => ({ configureService: { instanceId: id, state: acc } }),
      payload,
    );

  const configureRootRaw = async (payload: any) => {
    const sc = boardContext?.scopes[runtime.id];
    if (!sc) {
      throw new Error("Runtime not initialized");
    }
    if (isRuntimeBrowserClassType(runtime.type)) {
      await configureBrowserService(sc, service, payload);
    } else if (isRuntimeRestClassType(runtime.type)) {
      await configureRestService(sc, service, payload);
    } else if (isRuntimeGraphQLClassType(runtime.type)) {
      await configureGraphQLService(sc, service, payload);
    }
  };

  // Deliver a configure payload to the *active* node, then refresh the tree.
  const sendToActive = async (payload: any) => {
    await configureRootRaw(wrapForPath(payload, pathIds));
    await refreshRoot();
  };

  const addSub = (svc: ServiceClass) =>
    sendToActive({ appendService: { serviceId: svc.serviceId } });

  const removeSub = (instanceId: string) =>
    sendToActive({ removeService: instanceId });

  const reorderSub = (entries: PipelineEntry[]) =>
    sendToActive({ pipeline: entries });

  // Remove the active node itself from its parent pipeline.
  const removeActiveNode = async () => {
    const parentIds = pathIds.slice(0, -1);
    const payload = { removeService: active.instanceId };
    await configureRootRaw(wrapForPath(payload, parentIds));
    await refreshRoot();
    setPath((p) => p.slice(0, -1));
  };

  const openConfig = async () => {
    if (!boardContext || !service || !runtime) { return; }
    configReturnTo.current = uiExpanded ? "ui" : "root";
    let config: any = {};
    if (isRoot) {
      const sc = boardContext.scopes[runtime.id];
      try {
        if (isRuntimeBrowserClassType(runtime.type) && sc) {
          config = await getBrowserServiceConfig(sc, service);
        } else if (isRuntimeRestClassType(runtime.type) && sc) {
          config = await getRestServiceConfig(sc, service);
        } else if (isRuntimeGraphQLClassType(runtime.type) && sc) {
          config = await getGraphQLServiceConfig(sc, service);
        } else {
          config = service.state ?? {};
        }
      } catch {
        config = service.state ?? {};
      }
      setRootState(config);
    } else {
      // Sub-service config comes from the (already-loaded) tree snapshot.
      config = active.state ?? {};
    }
    setConfigDraft(config);
    setConfigError(null);
    setConfigExpanded(true);
  };

  const applyConfig = async () => {
    if (!boardContext || !service || !runtime) { return; }
    setConfigSaving(true);
    setConfigError(null);
    try {
      await sendToActive(configDraft);
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

  // ── Build the ServiceInstance + UI component for the active node ──
  const buildActive = (): { instance: ServiceInstance | null; UI: any; reason?: string } => {
    if (!boardContext) {
      return { instance: null, UI: null, reason: "Service UI not available" };
    }

    // Root node — use the real runtime instance.
    if (isRoot) {
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
        return {
          instance,
          UI,
          reason: scope ? "Service UI not available" : "Runtime not yet initialized",
        };
      }
      if (isRuntimeRestClassType(runtime.type)) {
        if (!scope) {
          return { instance: null, UI: null, reason: "Runtime not yet initialized" };
        }
        const instance = makeRestInstance(scope, service, boardName);
        const UI =
          findRestServiceUI({
            serviceId: service.serviceId,
            version: service.version,
            capabilities: service.capabilities,
          }) ?? RuntimeRestServiceUI;
        return { instance, UI };
      }
      if (isRuntimeGraphQLClassType(runtime.type)) {
        if (!scope) {
          return { instance: null, UI: null, reason: "Runtime not yet initialized" };
        }
        const instance = makeGraphQLInstance(scope, service, boardName);
        const UI =
          findGraphQLServiceUI(service.serviceId) ?? RuntimeGraphQLServiceUI;
        return { instance, UI };
      }
      return { instance: null, UI: null, reason: "Service UI not available for this runtime type" };
    }

    // Sub-service node — proxy instance routing configure() through the parent.
    const browserScope = scope as BrowserRuntimeScope | undefined;
    const app =
      (scope as any)?.getApp?.() ??
      browserScope?.findServiceInstance(service.uuid)?.[0]?.app ??
      null;

    const proxy: ServiceInstance = {
      uuid: active.instanceId,
      serviceId: active.serviceId,
      serviceName: active.serviceName,
      version: undefined,
      capabilities: activeCaps,
      state: active.state,
      board: boardName,
      app,
      configure: async (config: object) => {
        await sendToActive(config);
      },
      process: async () => {},
      getConfiguration: async () => active.state,
      destroy: async () => {},
    };

    let UI: any = null;
    if (isRuntimeBrowserClassType(runtime.type)) {
      UI =
        findBrowserServiceUI(active.serviceId) ??
        browserScope?.registry.findServiceModule(active.serviceId)?.createUI ??
        null;
    } else if (isRuntimeRestClassType(runtime.type)) {
      UI =
        findRestServiceUI({
          serviceId: active.serviceId,
          capabilities: activeCaps,
        }) ?? RuntimeRestServiceUI;
    } else if (isRuntimeGraphQLClassType(runtime.type)) {
      UI = findGraphQLServiceUI(active.serviceId) ?? RuntimeGraphQLServiceUI;
    }

    return { instance: proxy, UI, reason: "Service UI not available" };
  };

  const renderServiceUI = () => {
    if (!boardContext) {
      return <NotAvailable reason="Service UI not available" />;
    }

    const handleServiceAction = (cmd: ServiceAction) => {
      if (cmd.action === "remove") {
        if (isRoot) {
          boardContext.removeService({ uuid: cmd.service.uuid }, runtime);
          onClose();
        } else {
          removeActiveNode();
        }
      } else if (cmd.action === "rename" && cmd.payload && isRoot) {
        boardContext.setServiceName(runtime.id, cmd.service.uuid, cmd.payload);
      }
    };

    const { instance, UI, reason } = buildActive();
    if (!UI || !instance) {
      return <NotAvailable reason={reason ?? "Service UI not available"} />;
    }
    return (
      <UI
        service={instance}
        showBypassOnlyIfExplicit={!isRuntimeBrowserClassType(runtime.type)}
        draggable={false}
        onServiceAction={handleServiceAction}
      />
    );
  };

  // ── Breadcrumb ───────────────────────────────────────────────
  const renderBreadcrumb = () => {
    if (path.length === 0) {
      return null;
    }
    const crumbs = [
      { label: service.serviceName, depth: 0 },
      ...path.map((c, i) => ({ label: c.serviceName, depth: i + 1 })),
    ];
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginBottom: 14,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          flexShrink: 0,
          paddingBottom: 2,
        }}
      >
        <button
          onClick={() => setPath((p) => p.slice(0, -1))}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 8,
            border: `1px solid ${M.border}`,
            background: M.card,
            cursor: "pointer",
            flexShrink: 0,
            marginRight: 4,
          }}
          title="Up one level"
        >
          <MobileIcon name="chevronLeft" size={15} color={M.teal} strokeWidth={2} />
        </button>
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <button
                onClick={() => setPath((p) => p.slice(0, c.depth))}
                disabled={isLast}
                style={{
                  border: "none",
                  background: "none",
                  padding: "2px 4px",
                  cursor: isLast ? "default" : "pointer",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: isLast ? 700 : 500,
                  color: isLast ? M.textPrimary : M.teal,
                  whiteSpace: "nowrap",
                }}
              >
                {c.label}
              </button>
              {!isLast && (
                <MobileIcon name="chevronRight" size={12} color={M.textMuted} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderSubPipeline = () =>
    activeHasSub ? (
      <div
        style={{
          padding: "14px",
          background: "#faf8f6",
          border: `1px solid ${M.border}`,
          borderRadius: 14,
        }}
      >
        <MobileSubPipeline
          entries={activePipeline}
          registry={subRegistry}
          onOpen={(entry) =>
            setPath((p) => [
              ...p,
              {
                instanceId: entry.instanceId,
                serviceId: entry.serviceId,
                serviceName:
                  subRegistry.find((s) => s.serviceId === entry.serviceId)
                    ?.serviceName ?? entry.serviceId,
              },
            ])
          }
          onAdd={() => setAddPickerOpen(true)}
          onRemove={(id) => removeSub(id)}
          onReorder={(entries) => reorderSub(entries)}
        />
      </div>
    ) : null;

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        title={isRoot ? service.serviceName : active.serviceName}
        height={uiExpanded || configExpanded ? "92%" : "70%"}
      >
        {configExpanded ? (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {renderBreadcrumb()}
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
                rootLabel={active.serviceId ?? "root"}
              />
            </div>
          </div>
        ) : uiExpanded ? (
          <div
            style={{ display: "flex", flexDirection: "column", height: "100%" }}
          >
            {renderBreadcrumb()}
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
            {renderBreadcrumb()}

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

            {/* Sub-services pipeline */}
            {renderSubPipeline()}

            {/* Name row — only for the top-level board service */}
            {isRoot && (
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
            )}

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
                  {active.serviceId}
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
            {active.state !== undefined && (
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
                    {JSON.stringify(active.state, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Remove */}
            <button
              onClick={() => {
                if (isRoot) {
                  onRemove(service, runtime);
                  onClose();
                } else {
                  removeActiveNode();
                }
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
              {isRoot ? "Remove Service" : "Remove from pipeline"}
            </button>
          </div>
        )}
      </BottomSheet>

      {/* Service picker bound to the active sub-pipeline */}
      <AddServiceSheet
        open={addPickerOpen}
        onClose={() => setAddPickerOpen(false)}
        runtime={{ ...runtime, name: active.serviceName }}
        registry={subRegistry}
        onAdd={(svc) => addSub(svc)}
      />
    </>
  );
}
