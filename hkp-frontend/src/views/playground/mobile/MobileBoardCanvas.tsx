import { CSSProperties, useEffect, useRef, useState } from "react";
import { useBoardContext, BoardContextState } from "../../../BoardContext";
import {
  ProcessContext,
  RuntimeClass,
  RuntimeDescriptor,
  RuntimeScope,
  ServiceAction,
  ServiceClass,
  ServiceDescriptor,
  ServiceRegistry,
  isRuntimeBrowserClassType,
  toCanonicalRuntimeClassType,
} from "../../../types";
import { M, SERVICE_UI_ZOOM } from "./tokens";
import MobileIcon, { type MobileIconName } from "./MobileIcon";
import AddRuntimeSheet from "./AddRuntimeSheet";
import AddServiceSheet from "./AddServiceSheet";
import ServiceSheet from "./ServiceSheet";
import { findServiceUI } from "../../../runtime/browser/UIRegistry";
import BrowserRuntimeScope from "../../../runtime/browser/BrowserRuntimeScope";
import MobileFacadeView from "./MobileFacadeView";

// Presence of a `bridge` prop means this canvas renders a *cloud* board: browser
// runtime results are forwarded to the coordinator over `bridge.ws`. When omitted
// the canvas is a local playground board and results chain to the next runtime.
export type MobileBoardBridge = { ws: WebSocket | null };

type MobileBoardCanvasProps = {
  bridge?: MobileBoardBridge;
};

// ── Flow connector between service cards ───────────────────────
function FlowArrow() {
  return (
    <div
      style={{ display: "flex", justifyContent: "center", padding: "5px 0" }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        <div style={{ width: 1.5, height: 10, background: M.borderStrong }} />
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: "4px solid transparent",
            borderRight: "4px solid transparent",
            borderTop: `5px solid ${M.borderStrong}`,
          }}
        />
      </div>
    </div>
  );
}

// ── Runtime-to-runtime connector ───────────────────────────────
function RuntimeConnector() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "8px 0",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{ height: 1, flex: 1, background: M.borderStrong, maxWidth: 60 }}
      />
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: M.textMuted,
          textTransform: "uppercase",
          background: M.bg,
          padding: "0 6px",
        }}
      >
        output ↓
      </span>
      <div
        style={{ height: 1, flex: 1, background: M.borderStrong, maxWidth: 60 }}
      />
    </div>
  );
}

// ── Reorder steppers (up/down) ─────────────────────────────────
// Shared by service cards and runtime rows in reorder mode. Ends are disabled
// (can't move the first item up or the last item down).
function Stepper({
  canUp,
  canDown,
  onUp,
  onDown,
}: {
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  const btn = (enabled: boolean): CSSProperties => ({
    width: 34,
    height: 30,
    border: `1px solid ${M.border}`,
    borderRadius: 8,
    background: enabled ? "#fff" : "rgba(0,0,0,0.03)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: enabled ? "pointer" : "default",
    padding: 0,
  });
  return (
    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
      <button
        onClick={onUp}
        disabled={!canUp}
        aria-label="Move up"
        style={btn(canUp)}
      >
        <MobileIcon
          name="chevronUp"
          size={15}
          color={canUp ? M.textSecondary : M.textMuted}
          strokeWidth={2}
        />
      </button>
      <button
        onClick={onDown}
        disabled={!canDown}
        aria-label="Move down"
        style={btn(canDown)}
      >
        <MobileIcon
          name="chevronDown"
          size={15}
          color={canDown ? M.textSecondary : M.textMuted}
          strokeWidth={2}
        />
      </button>
    </div>
  );
}

// ── Service card ───────────────────────────────────────────────
function ServiceCard({
  service,
  onTap,
  active,
  reordering,
  canUp,
  canDown,
  onMoveUp,
  onMoveDown,
}: {
  service: ServiceDescriptor;
  onTap: () => void;
  active: boolean;
  reordering: boolean;
  canUp: boolean;
  canDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const body = (
    <>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 9,
          background: M.tealLight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <MobileIcon name="cpu" size={18} color={M.tealDark} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: M.textPrimary }}>
          {service.serviceName}
        </div>
        {service.description && (
          <div
            style={{
              fontSize: 12,
              color: M.textMuted,
              marginTop: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {service.description}
          </div>
        )}
      </div>
    </>
  );

  const cardStyle: CSSProperties = {
    width: "100%",
    background: M.card,
    border: `1.5px solid ${active ? M.teal : M.border}`,
    borderRadius: 14,
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    textAlign: "left",
    boxShadow: active
      ? `0 0 0 3px ${M.tealLight}`
      : "0 1px 3px rgba(0,0,0,0.06)",
    transition: "all 0.15s",
  };

  if (reordering) {
    // A static row dedicated to reordering — tapping the body does nothing; the
    // steppers own all interaction.
    return (
      <div style={{ ...cardStyle, cursor: "default", marginBottom: 8 }}>
        {body}
        <Stepper
          canUp={canUp}
          canDown={canDown}
          onUp={onMoveUp}
          onDown={onMoveDown}
        />
      </div>
    );
  }

  return (
    <div>
      <button onClick={onTap} style={{ ...cardStyle, cursor: "pointer" }}>
        {body}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: M.green,
            }}
          />
          <MobileIcon name="chevronRight" size={14} color={M.textMuted} />
        </div>
      </button>
      <FlowArrow />
    </div>
  );
}

// ── Runtime card ───────────────────────────────────────────────
function RuntimeCard({
  runtime,
  services,
  scope,
  boardContext,
  activeServiceId,
  onServiceTap,
  onAddService,
  onRemoveRuntime,
}: {
  runtime: RuntimeDescriptor;
  services: ServiceDescriptor[];
  scope: RuntimeScope | undefined;
  registry: ServiceRegistry;
  boardName: string;
  boardContext: BoardContextState;
  activeServiceId: string | null;
  onServiceTap: (svc: ServiceDescriptor, rt: RuntimeDescriptor) => void;
  onAddService: () => void;
  onRemoveRuntime: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [fullView, setFullView] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reordering, setReordering] = useState(false);
  // Reordering is only meaningful with 2+ services; if a removal drops the list
  // to a single service, fall back to the normal (tappable) rendering.
  const isReordering = reordering && services.length > 1;

  const moveService = (svc: ServiceDescriptor, index: number, dir: -1 | 1) => {
    // reorderService treats the target as an insertion slot and subtracts 1 when
    // moving down; up → index-1, down → index+2 lands the service one slot over.
    const target = dir === -1 ? index - 1 : index + 2;
    boardContext.arrangeService(runtime, svc.uuid, target);
  };

  const handleServiceAction = (cmd: ServiceAction) => {
    if (cmd.action === "remove") {
      boardContext.removeService({ uuid: cmd.service.uuid }, runtime);
    } else if (cmd.action === "rename" && cmd.payload) {
      boardContext.setServiceName(runtime.id, cmd.service.uuid, cmd.payload);
    }
  };

  if (fullView && scope) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          background: M.bg,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Compact header strip for returning to card view */}
        <div
          style={{
            background: M.runtimeBg,
            paddingTop: "max(10px, env(safe-area-inset-top))",
            paddingBottom: 10,
            paddingLeft: 12,
            paddingRight: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
            borderBottom: `1px solid ${M.runtimeBorder}`,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: M.blue,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: 600,
              color: M.textPrimary,
            }}
          >
            {runtime.name}
          </span>
          <button
            onClick={() => onAddService()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              border: `1px solid ${M.runtimeBorder}`,
              borderRadius: 7,
              background: "#fff",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              color: M.blue,
            }}
          >
            <MobileIcon name="plus" size={11} color={M.blue} />
            Service
          </button>
          <button
            onClick={() => setFullView(false)}
            title="Switch to card view"
            style={{
              width: 28,
              height: 28,
              border: "none",
              background: "rgba(255,255,255,0.5)",
              borderRadius: 7,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <MobileIcon name="minimize2" size={14} color={M.textSecondary} />
          </button>
        </div>
        {/* Full service UIs — rendered directly so cards fill the container */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
            background: "#fff",
            padding: "6px",
          }}
        >
          <div
            style={{
              zoom: SERVICE_UI_ZOOM,
              width: `calc(100% / ${SERVICE_UI_ZOOM})`,
            }}
          >
            {services.map((svc) => {
              const browserScope = scope as BrowserRuntimeScope | undefined;
              const instance =
                browserScope?.findServiceInstance(svc.uuid)?.[0] ?? null;
              const UI = instance
                ? (findServiceUI(svc.serviceId) ??
                  browserScope?.registry.findServiceModule(svc.serviceId)
                    ?.createUI ??
                  null)
                : null;
              if (!UI || !instance) {
                return null;
              }
              return (
                <UI
                  key={svc.uuid}
                  service={instance}
                  showBypassOnlyIfExplicit={false}
                  draggable={false}
                  onServiceAction={handleServiceAction}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: M.runtimeBg,
        border: `1.5px solid ${M.runtimeBorder}`,
        borderRadius: 18,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: M.blue,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: M.blue,
              }}
            >
              Runtime
            </span>
            <span
              style={{
                fontSize: 10,
                background: M.blueLight,
                color: M.blue,
                padding: "1px 6px",
                borderRadius: 4,
                fontWeight: 500,
              }}
            >
              {runtime.type}
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: M.textPrimary,
              marginTop: 1,
            }}
          >
            {runtime.name}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {services.length > 1 && !collapsed && (
            <button
              onClick={() => setReordering((v) => !v)}
              title={isReordering ? "Done reordering" : "Reorder services"}
              style={{
                width: 28,
                height: 28,
                border: "none",
                background: isReordering ? M.teal : "rgba(255,255,255,0.5)",
                borderRadius: 7,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <MobileIcon
                name={isReordering ? "check" : "moveVertical"}
                size={14}
                color={isReordering ? "#fff" : M.textSecondary}
                strokeWidth={isReordering ? 2.2 : 1.8}
              />
            </button>
          )}
          {scope && services.length > 0 && !isReordering && (
            <button
              onClick={() => setFullView(true)}
              title="Show full service UIs"
              style={{
                width: 28,
                height: 28,
                border: "none",
                background: "rgba(255,255,255,0.5)",
                borderRadius: 7,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <MobileIcon name="maximize2" size={14} color={M.textSecondary} />
            </button>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              width: 28,
              height: 28,
              border: "none",
              background: "rgba(255,255,255,0.5)",
              borderRadius: 7,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <MobileIcon
              name={collapsed ? "chevronDown" : "chevronUp"}
              size={14}
              color={M.textSecondary}
            />
          </button>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              title="More options"
              style={{
                width: 28,
                height: 28,
                border: "none",
                background: "rgba(255,255,255,0.5)",
                borderRadius: 7,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <MobileIcon name="more" size={14} color={M.textSecondary} />
            </button>
            {menuOpen && (
              <>
                <div
                  onClick={() => setMenuOpen(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 100 }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    right: 0,
                    background: "#fff",
                    border: `1px solid ${M.border}`,
                    borderRadius: 10,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                    minWidth: 148,
                    zIndex: 101,
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => { setMenuOpen(false); onRemoveRuntime(); }}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: 14,
                      fontFamily: "inherit",
                      fontWeight: 500,
                      color: M.danger,
                    }}
                  >
                    <MobileIcon name="trash" size={14} color={M.danger} />
                    Delete Runtime
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Services */}
      {!collapsed && (
        <div style={{ padding: "0 12px 6px" }}>
          {services.length === 0 ? (
            <div
              style={{
                fontSize: 12,
                color: M.textMuted,
                textAlign: "center",
                padding: "8px 0",
                fontStyle: "italic",
              }}
            >
              No services — tap + Service to add one
            </div>
          ) : (
            services.map((svc, i) => (
              <ServiceCard
                key={svc.uuid}
                service={svc}
                onTap={() => onServiceTap(svc, runtime)}
                active={activeServiceId === svc.uuid}
                reordering={isReordering}
                canUp={i > 0}
                canDown={i < services.length - 1}
                onMoveUp={() => moveService(svc, i, -1)}
                onMoveDown={() => moveService(svc, i, 1)}
              />
            ))
          )}
        </div>
      )}

      {!collapsed && !isReordering && (
        <div style={{ padding: "0px 12px 12px" }}>
          <button
            onClick={onAddService}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "11px 14px",
              border: `1.5px dashed ${M.teal}`,
              borderRadius: 14,
              background: M.tealLight,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              color: M.tealDark,
              fontFamily: "inherit",
            }}
          >
            <MobileIcon name="plus" size={16} color={M.tealDark} />
            Add Service
          </button>
        </div>
      )}
    </div>
  );
}

// ── Compact runtime row (runtime reorder mode) ─────────────────
function RuntimeReorderRow({
  runtime,
  serviceCount,
  canUp,
  canDown,
  onMoveUp,
  onMoveDown,
}: {
  runtime: RuntimeDescriptor;
  serviceCount: number;
  canUp: boolean;
  canDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div
      style={{
        background: M.runtimeBg,
        border: `1.5px solid ${M.runtimeBorder}`,
        borderRadius: 14,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: M.blue,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: M.textPrimary,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {runtime.name}
        </div>
        <div style={{ fontSize: 11, color: M.textMuted, marginTop: 1 }}>
          {runtime.type} · {serviceCount} service{serviceCount !== 1 ? "s" : ""}
        </div>
      </div>
      <Stepper
        canUp={canUp}
        canDown={canDown}
        onUp={onMoveUp}
        onDown={onMoveDown}
      />
    </div>
  );
}

// ── Board list (runtimes + services) ────────────────────────────
function BoardList({
  onServiceTap,
  activeServiceId,
  onAddService,
  onRemoveRuntime,
  onShowAddRuntime,
}: {
  onServiceTap: (svc: ServiceDescriptor, rt: RuntimeDescriptor) => void;
  activeServiceId: string | null;
  onAddService: (rt: RuntimeDescriptor) => void;
  onRemoveRuntime: (rt: RuntimeDescriptor) => void;
  onShowAddRuntime: () => void;
}) {
  const boardContext = useBoardContext();
  const [reorderingRuntimes, setReorderingRuntimes] = useState(false);
  if (!boardContext) return null;
  const { runtimes, services, scopes, registry, boardName } = boardContext;

  // Only meaningful with 2+ runtimes; a removal that drops to one exits the mode.
  const isReorderingRuntimes = reorderingRuntimes && runtimes.length > 1;

  const moveRuntime = (rt: RuntimeDescriptor, index: number, dir: -1 | 1) => {
    // Same insertion-slot semantics as reorderService: up → index-1,
    // down → index+2 (reorderRuntime subtracts 1 when moving down).
    const target = dir === -1 ? index - 1 : index + 2;
    boardContext.arrangeRuntime(rt.id, target);
  };

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        padding: 16,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {isReorderingRuntimes
          ? runtimes.map((rt, i) => (
              <RuntimeReorderRow
                key={rt.id}
                runtime={rt}
                serviceCount={(services[rt.id] ?? []).length}
                canUp={i > 0}
                canDown={i < runtimes.length - 1}
                onMoveUp={() => moveRuntime(rt, i, -1)}
                onMoveDown={() => moveRuntime(rt, i, 1)}
              />
            ))
          : runtimes.map((rt, i) => (
              <div key={rt.id}>
                <RuntimeCard
                  runtime={rt}
                  services={services[rt.id] ?? []}
                  scope={scopes[rt.id]}
                  registry={registry[rt.id] ?? []}
                  boardName={boardName ?? ""}
                  boardContext={boardContext}
                  activeServiceId={activeServiceId}
                  onServiceTap={onServiceTap}
                  onAddService={() => onAddService(rt)}
                  onRemoveRuntime={() => onRemoveRuntime(rt)}
                />
                {i < runtimes.length - 1 && <RuntimeConnector />}
              </div>
            ))}

        {!isReorderingRuntimes && (
          <button
            onClick={onShowAddRuntime}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 14,
              border: `1.5px dashed ${M.borderStrong}`,
              borderRadius: 16,
              background: "rgba(255,255,255,0.5)",
              color: M.textSecondary,
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <MobileIcon name="plus" size={16} color={M.textSecondary} />
            Add Runtime
          </button>
        )}

        {runtimes.length > 1 && (
          <button
            onClick={() => setReorderingRuntimes((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 14,
              border: `1.5px ${isReorderingRuntimes ? "solid" : "dashed"} ${
                isReorderingRuntimes ? M.teal : M.borderStrong
              }`,
              borderRadius: 16,
              background: isReorderingRuntimes
                ? M.teal
                : "rgba(255,255,255,0.5)",
              color: isReorderingRuntimes ? "#fff" : M.textSecondary,
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <MobileIcon
              name={isReorderingRuntimes ? "check" : "moveVertical"}
              size={16}
              color={isReorderingRuntimes ? "#fff" : M.textSecondary}
              strokeWidth={isReorderingRuntimes ? 2.2 : 1.8}
            />
            {isReorderingRuntimes ? "Done" : "Reorder Runtimes"}
          </button>
        )}
      </div>
      <div style={{ height: 20 }} />
    </div>
  );
}

// ── Full-screen single-service view ───────────────────────────
function FullServiceView({
  service,
  runtime,
  onBack,
}: {
  service: ServiceDescriptor;
  runtime: RuntimeDescriptor;
  onBack: () => void;
}) {
  const boardContext = useBoardContext();
  if (!boardContext) {
    return null;
  }
  const { scopes } = boardContext;

  const handleServiceAction = (cmd: ServiceAction) => {
    if (cmd.action === "remove") {
      boardContext.removeService({ uuid: cmd.service.uuid }, runtime);
      if (cmd.service.uuid === service.uuid) {
        onBack();
      }
    } else if (cmd.action === "rename" && cmd.payload) {
      boardContext.setServiceName(runtime.id, cmd.service.uuid, cmd.payload);
    }
  };

  const browserScope =
    runtime.type === "browser"
      ? (scopes[runtime.id] as BrowserRuntimeScope | undefined)
      : undefined;

  const serviceInstance =
    browserScope?.findServiceInstance(service.uuid)?.[0] ?? null;
  const ServiceUI = serviceInstance
    ? (findServiceUI(service.serviceId) ??
      browserScope?.registry.findServiceModule(service.serviceId)?.createUI ??
      null)
    : null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 50,
        background: M.bg,
        display: "flex",
        flexDirection: "column",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: `rgba(242,237,232,0.95)`,
          backdropFilter: "blur(12px)",
          paddingTop: "max(10px, env(safe-area-inset-top))",
          paddingBottom: "10px",
          paddingLeft: "4px",
          paddingRight: "16px",
          display: "flex",
          alignItems: "center",
          gap: 4,
          borderBottom: `1px solid ${M.border}`,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            width: 40,
            height: 40,
            border: "none",
            background: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <MobileIcon
            name="chevronLeft"
            size={22}
            color={M.teal}
            strokeWidth={2}
          />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: M.textPrimary,
              lineHeight: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {service.serviceName}
          </div>
          <div style={{ fontSize: 11, color: M.textMuted, marginTop: 2 }}>
            {runtime.name}
          </div>
        </div>
      </div>

      {/* Bare service UI — no runtime chrome */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          style={{
            zoom: SERVICE_UI_ZOOM,
            width: `calc(100% / ${SERVICE_UI_ZOOM})`,
          }}
        >
          {ServiceUI && serviceInstance ? (
            <ServiceUI
              service={serviceInstance}
              showBypassOnlyIfExplicit={false}
              draggable={false}
              onServiceAction={handleServiceAction}
            />
          ) : (
            <div
              style={{
                padding: 24,
                fontSize: 14,
                color: M.textMuted,
                textAlign: "center",
              }}
            >
              {scopes[runtime.id]
                ? "Service UI not available"
                : "Runtime not yet initialized"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Wires the per-runtime scope hooks that the desktop `BrowserRuntime` /
 * `RuntimeRest` components normally install (the mobile renderer mounts neither).
 *
 * `scope.onResult` is wired for *every* runtime — without it results have nowhere
 * to go: the coordinator never receives `result-from-browser`, and a remote (REST)
 * runtime awaiting a response (e.g. a C++ HTTP server using RESULT_AWAITING_RESPONSE)
 * is never resolved, so the request hangs. The remaining hooks
 * (`processRuntimeByName`, `configureServiceInRuntime`, `onAction`) are browser-only.
 *
 * - Cloud board (`bridge` set): forward browser results to the coordinator, and
 *   resolve coordinator-initiated calls via `context.onResolve`.
 * - Playground (`bridge` omitted): resolve awaiting callers, else chain results to
 *   the next runtime locally.
 *
 * NOTE: this hook hand-rolls scope wiring that overlaps with the desktop runtime
 * components and `Board`'s `onRuntimeResult`. See `docs/todos/scope-wiring-refactor.md`.
 */
function useWireBrowserScopes(
  boardContext: BoardContextState | null,
  bridge: MobileBoardBridge | undefined,
) {
  // Keep the live bridge in a ref so the onResult closure always sends to the
  // current socket (it reconnects) without re-wiring every scope.
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;

  const runtimes = boardContext?.runtimes;
  const scopes = boardContext?.scopes;

  useEffect(() => {
    if (!boardContext) {
      return;
    }
    const { runtimes, scopes, runtimeApis, appContext, user } = boardContext;

    for (const rt of runtimes) {
      const scope = scopes[rt.id] as RuntimeScope | undefined;
      if (!scope) {
        continue;
      }

      scope.authenticatedUser = user;

      // `onResult` must be wired for *every* runtime that hands a result back to
      // the app, not just browser runtimes. On desktop the per-runtime
      // <BrowserRuntime>/<RuntimeRest> components install it; the mobile renderer
      // mounts neither, so we wire it here. A remote (REST) runtime needs it just
      // as much: a C++ HTTP server using the inversion-of-control pull pattern
      // pushes its result with `context.onResolve` set (RESULT_AWAITING_RESPONSE)
      // and parks the HTTP connection until we resolve it. Left on the unset stub,
      // that resolve never fires and the request hangs forever.
      scope.onResult = async (
        _instanceId: string | null,
        result: unknown,
        context?: ProcessContext | null,
      ) => {
        // A coordinator- or runtime-initiated call carries its own resolver.
        if (context?.onResolve) {
          context.onResolve(result);
          return;
        }

        const activeBridge = bridgeRef.current;
        if (activeBridge) {
          // Cloud board: the coordinator routes to the next runtime — just hand
          // the result back to it.
          const ws = activeBridge.ws;
          if (ws && ws.readyState === WebSocket.OPEN && result !== null) {
            ws.send(
              JSON.stringify({
                type: "result-from-browser",
                runtimeId: rt.id,
                data: result,
              }),
            );
          }
          return;
        }

        // Playground: chain to the next runtime locally.
        const idx = runtimes.findIndex((r) => r.id === rt.id);
        const next = runtimes[idx + 1];
        const nextScope = next && scopes[next.id];
        const nextApi =
          nextScope &&
          (runtimeApis[next.type] ||
            runtimeApis[toCanonicalRuntimeClassType(next.type)]);
        if (nextApi && nextScope && result !== null) {
          nextApi.processRuntime(nextScope, result, null, context);
        }
      };

      // The remaining hooks exist only on browser scopes; remote (REST) scopes
      // drive notifications and config through their own REST/WebSocket handlers.
      if (!isRuntimeBrowserClassType(rt.type)) {
        continue;
      }
      const browserScope = scope as BrowserRuntimeScope;

      browserScope.processRuntimeByName = async (
        name: string,
        params: unknown,
      ) => {
        const target = runtimes.find((r) => r.name === name);
        if (target) {
          const targetScope = scopes[target.id];
          const targetApi =
            runtimeApis[target.type] ||
            runtimeApis[toCanonicalRuntimeClassType(target.type)];
          if (targetScope && targetApi) {
            return targetApi.processRuntime(targetScope, params, null);
          }
        }
        console.error(
          `MobileBoardCanvas.processRuntimeByName: no runtime named "${name}"`,
        );
      };

      browserScope.configureServiceInRuntime = async (
        runtimeId: string,
        serviceUuid: string,
        config: unknown,
      ) => {
        const targetScope = scopes[runtimeId] as
          | BrowserRuntimeScope
          | undefined;
        const svc = targetScope?.findServiceInstance(serviceUuid)?.[0];
        if (svc?.configure) {
          await svc.configure(config);
        }
      };

      browserScope.onAction = (action: ServiceAction) => {
        if (action.action === "notification" && action.payload) {
          appContext?.pushNotification(action.payload);
          return true;
        }
        return false;
      };
    }
    // Re-wire when the set of runtimes or their scopes changes (e.g. a runtime is
    // added). The bridge socket is read through a ref, so it isn't a dependency.
  }, [boardContext, runtimes, scopes]);
}

// ── App ⇄ Board view toggle (only shown when the board has a facade) ──────────
function ViewToggle({
  view,
  onChange,
}: {
  view: "facade" | "board";
  onChange: (v: "facade" | "board") => void;
}) {
  const segments: Array<{ value: "facade" | "board"; label: string; icon: MobileIconName }> = [
    { value: "facade", label: "App", icon: "home" },
    { value: "board", label: "Board", icon: "list" },
  ];
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "8px 0",
        flexShrink: 0,
        background: M.bg,
        borderBottom: `1px solid ${M.border}`,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          background: M.card,
          border: `1px solid ${M.border}`,
          borderRadius: 10,
          padding: 3,
          gap: 2,
        }}
      >
        {segments.map((seg) => {
          const active = view === seg.value;
          return (
            <button
              key={seg.value}
              onClick={() => onChange(seg.value)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                border: "none",
                borderRadius: 8,
                background: active ? M.teal : "transparent",
                color: active ? "#fff" : M.textSecondary,
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <MobileIcon
                name={seg.icon}
                size={14}
                color={active ? "#fff" : M.textMuted}
                strokeWidth={active ? 2.2 : 1.8}
              />
              {seg.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Canvas root ─────────────────────────────────────────────────
export default function MobileBoardCanvas({ bridge }: MobileBoardCanvasProps) {
  const boardContext = useBoardContext();

  const [view, setView] = useState<"facade" | "board">("facade");
  const [showAddRuntime, setShowAddRuntime] = useState(false);
  const [addServiceRuntime, setAddServiceRuntime] =
    useState<RuntimeDescriptor | null>(null);
  const [selectedService, setSelectedService] =
    useState<ServiceDescriptor | null>(null);
  const [selectedServiceRuntime, setSelectedServiceRuntime] =
    useState<RuntimeDescriptor | null>(null);
  const [fullScreenService, setFullScreenService] = useState<{
    service: ServiceDescriptor;
    runtime: RuntimeDescriptor;
  } | null>(null);

  useWireBrowserScopes(boardContext, bridge);

  // When a different board loads, prefer its facade ("App") view by default,
  // mirroring the desktop where the facade is shown first when present.
  const loadedBoardName = boardContext?.boardName;
  useEffect(() => {
    setView("facade");
  }, [loadedBoardName]);

  if (!boardContext) {
    return null;
  }

  const { runtimes, registry, availableRuntimeEngines, facade, boardName } =
    boardContext;
  const showFacade = !!facade && view === "facade";

  const handleAddRuntime = (rtClass: RuntimeClass) => {
    boardContext.addRuntime({
      ...rtClass,
      name: `${rtClass.name} ${runtimes.length + 1}`,
    });
  };

  const handleAddService = (svc: ServiceClass) => {
    if (!addServiceRuntime) return;
    const runtime = runtimes.find((rt) => rt.id === addServiceRuntime.id);
    if (runtime) {
      boardContext.addService(svc, runtime);
    }
  };

  const handleRemoveService = (
    svc: ServiceDescriptor,
    rt: RuntimeDescriptor,
  ) => {
    boardContext.removeService({ uuid: svc.uuid }, rt);
  };

  const handleRenameService = (
    runtimeId: string,
    instanceId: string,
    name: string,
  ) => {
    boardContext.setServiceName(runtimeId, instanceId, name);
  };

  const handleRemoveRuntime = (rt: RuntimeDescriptor) => {
    boardContext.removeRuntime(rt);
  };

  const activeRegistry = addServiceRuntime
    ? (registry[addServiceRuntime.id] ?? [])
    : [];

  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        ...(showFacade
          ? {}
          : {
              backgroundImage:
                "radial-gradient(circle, #c8c0b8 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }),
      }}
    >
      {facade && <ViewToggle view={view} onChange={setView} />}

      {showFacade ? (
        <MobileFacadeView
          facade={facade}
          boardContext={boardContext}
          boardName={boardName ?? ""}
        />
      ) : (
        <BoardList
          onServiceTap={(svc, rt) => {
            setSelectedService(svc);
            setSelectedServiceRuntime(rt);
          }}
          activeServiceId={selectedService?.uuid ?? null}
          onAddService={setAddServiceRuntime}
          onRemoveRuntime={handleRemoveRuntime}
          onShowAddRuntime={() => setShowAddRuntime(true)}
        />
      )}

      {/* Sheets */}
      <AddRuntimeSheet
        open={showAddRuntime}
        onClose={() => setShowAddRuntime(false)}
        availableEngines={availableRuntimeEngines}
        onAdd={handleAddRuntime}
      />
      <AddServiceSheet
        open={!!addServiceRuntime && !selectedService}
        onClose={() => setAddServiceRuntime(null)}
        runtime={addServiceRuntime}
        registry={activeRegistry}
        onAdd={handleAddService}
      />
      <ServiceSheet
        open={!!selectedService}
        onClose={() => {
          setSelectedService(null);
          setSelectedServiceRuntime(null);
        }}
        service={selectedService}
        runtime={selectedServiceRuntime}
        onRemove={handleRemoveService}
        onRename={handleRenameService}
      />
      {fullScreenService && (
        <FullServiceView
          service={fullScreenService.service}
          runtime={fullScreenService.runtime}
          onBack={() => setFullScreenService(null)}
        />
      )}
    </div>
  );
}
