import { useState } from "react";
import { useBoardContext, BoardContextState } from "../../../BoardContext";
import { RuntimeClass, RuntimeDescriptor, ServiceClass, ServiceDescriptor, ServiceAction, ServiceRegistry, RuntimeScope } from "../../../types";
import { M } from "./tokens";
import MobileIcon, { type MobileIconName } from "./MobileIcon";
import AddRuntimeSheet from "./AddRuntimeSheet";
import AddServiceSheet from "./AddServiceSheet";
import ServiceSheet from "./ServiceSheet";
import RuntimeUI from "../../../ui-components/runtime-ui";

type Tab = "board" | "browser" | "settings";

type MobilePlaygroundInnerProps = {
  suggestedName?: string;
  onSaveBoard?: () => void;
};

// ── Flow connector between service cards ───────────────────────
function FlowArrow() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "5px 0" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        <div style={{ width: 1.5, height: 10, background: M.borderStrong }} />
        <div style={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: `5px solid ${M.borderStrong}` }} />
      </div>
    </div>
  );
}

// ── Runtime-to-runtime connector ───────────────────────────────
function RuntimeConnector() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "8px 0", alignItems: "center", gap: 8 }}>
      <div style={{ height: 1, flex: 1, background: M.borderStrong, maxWidth: 60 }} />
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: M.textMuted, textTransform: "uppercase", background: M.bg, padding: "0 6px" }}>output ↓</span>
      <div style={{ height: 1, flex: 1, background: M.borderStrong, maxWidth: 60 }} />
    </div>
  );
}

// ── Service card ───────────────────────────────────────────────
function ServiceCard({
  service,
  isLast,
  onTap,
  active,
}: {
  service: ServiceDescriptor;
  isLast: boolean;
  onTap: () => void;
  active: boolean;
}) {
  return (
    <div>
      <button
        onClick={onTap}
        style={{
          width: "100%",
          background: M.card,
          border: `1.5px solid ${active ? M.teal : M.border}`,
          borderRadius: 14,
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          cursor: "pointer",
          textAlign: "left",
          boxShadow: active ? `0 0 0 3px ${M.tealLight}` : "0 1px 3px rgba(0,0,0,0.06)",
          transition: "all 0.15s",
        }}
      >
        <div style={{ width: 36, height: 36, borderRadius: 9, background: M.tealLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <MobileIcon name="cpu" size={18} color={M.tealDark} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: M.textPrimary }}>{service.serviceName}</div>
          {service.description && (
            <div style={{ fontSize: 12, color: M.textMuted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{service.description}</div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: M.green }} />
          <MobileIcon name="chevronRight" size={14} color={M.textMuted} />
        </div>
      </button>
      {!isLast && <FlowArrow />}
    </div>
  );
}

// ── Runtime card ───────────────────────────────────────────────
function RuntimeCard({
  runtime,
  services,
  scope,
  registry,
  boardName,
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

  const handleServiceAction = (cmd: ServiceAction) => {
    if (cmd.action === "remove") {
      boardContext.removeService({ uuid: cmd.service.uuid }, runtime);
    } else if (cmd.action === "rename" && cmd.payload) {
      boardContext.setServiceName(runtime.id, cmd.service.uuid, cmd.payload);
    }
  };

  if (fullView && scope) {
    return (
      <div style={{ borderRadius: 18, overflow: "hidden", border: `1.5px solid ${M.runtimeBorder}` }}>
        {/* Compact header strip for returning to card view */}
        <div style={{ background: M.runtimeBg, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${M.runtimeBorder}` }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: M.blue, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: M.textPrimary }}>{runtime.name}</span>
          <button
            onClick={() => onAddService()}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", border: `1px solid ${M.runtimeBorder}`, borderRadius: 7, background: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600, color: M.blue }}
          >
            <MobileIcon name="plus" size={11} color={M.blue} />
            Service
          </button>
          <button
            onClick={() => setFullView(false)}
            title="Switch to card view"
            style={{ width: 28, height: 28, border: "none", background: "rgba(255,255,255,0.5)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <MobileIcon name="minimize2" size={14} color={M.textSecondary} />
          </button>
        </div>
        {/* Full service UIs via RuntimeUI */}
        <div style={{ background: "#fff" }}>
          <RuntimeUI
            runtime={runtime}
            scope={scope}
            services={services}
            registry={registry}
            boardName={boardName}
            isExpanded={true}
            wrapServices={false}
            columnServices={true}
            frameless={true}
            onExpand={() => {}}
            onWrapServices={() => {}}
            onAddService={(svc: ServiceClass) => boardContext.addService(svc, runtime)}
            onServiceAction={handleServiceAction}
            onArrangeService={() => {}}
            onResult={async () => {}}
            processRuntimeByName={async () => {}}
            onSave={() => {}}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: M.runtimeBg, border: `1.5px solid ${M.runtimeBorder}`, borderRadius: 18, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: M.blue, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: M.blue }}>Runtime</span>
            <span style={{ fontSize: 10, background: M.blueLight, color: M.blue, padding: "1px 6px", borderRadius: 4, fontWeight: 500 }}>{runtime.type}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: M.textPrimary, marginTop: 1 }}>{runtime.name}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={onAddService}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", border: `1px solid ${M.runtimeBorder}`, borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600, color: M.blue }}
          >
            <MobileIcon name="plus" size={11} color={M.blue} />
            Service
          </button>
          {scope && services.length > 0 && (
            <button
              onClick={() => setFullView(true)}
              title="Show full service UIs"
              style={{ width: 28, height: 28, border: "none", background: "rgba(255,255,255,0.5)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <MobileIcon name="maximize2" size={14} color={M.textSecondary} />
            </button>
          )}
          <button
            onClick={onRemoveRuntime}
            style={{ width: 28, height: 28, border: "none", background: "rgba(255,255,255,0.5)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            title="Remove runtime"
          >
            <MobileIcon name="trash" size={13} color={M.textMuted} />
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{ width: 28, height: 28, border: "none", background: "rgba(255,255,255,0.5)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <MobileIcon name={collapsed ? "chevronDown" : "chevronUp"} size={14} color={M.textSecondary} />
          </button>
        </div>
      </div>

      {/* Services */}
      {!collapsed && (
        <div style={{ padding: "0 12px 12px" }}>
          {services.length === 0 ? (
            <div style={{ fontSize: 12, color: M.textMuted, textAlign: "center", padding: "8px 0", fontStyle: "italic" }}>
              No services — tap + Service to add one
            </div>
          ) : (
            services.map((svc, i) => (
              <ServiceCard
                key={svc.uuid}
                service={svc}
                isLast={i === services.length - 1}
                onTap={() => onServiceTap(svc, runtime)}
                active={activeServiceId === svc.uuid}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Board tab ──────────────────────────────────────────────────
function BoardTab({
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
  if (!boardContext) return null;
  const { runtimes, services, scopes, registry, boardName } = boardContext;

  return (
    <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch", padding: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {runtimes.map((rt, i) => (
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

        <button
          onClick={onShowAddRuntime}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, border: `1.5px dashed ${M.borderStrong}`, borderRadius: 16, background: "rgba(255,255,255,0.5)", color: M.textSecondary, fontFamily: "inherit", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
        >
          <MobileIcon name="plus" size={16} color={M.textSecondary} />
          Add Runtime
        </button>
      </div>
      <div style={{ height: 20 }} />
    </div>
  );
}

// ── Browser tab ────────────────────────────────────────────────
function BrowserTab() {
  const boardContext = useBoardContext();
  if (!boardContext) return null;
  const { runtimes, services } = boardContext;
  const allServices = runtimes.flatMap((rt) => (services[rt.id] ?? []).map((s) => ({ ...s, _rtName: rt.name })));

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: M.textMuted, textTransform: "uppercase", marginBottom: 10 }}>Runtimes</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
        {runtimes.map((rt) => (
          <div key={rt.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: M.card, borderRadius: 10, border: `1px solid ${M.border}` }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: M.blue, flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 500, color: M.textPrimary, flex: 1 }}>{rt.name}</span>
            <span style={{ fontSize: 11, color: M.textMuted, background: "#f0ede9", padding: "2px 7px", borderRadius: 5 }}>{rt.type}</span>
          </div>
        ))}
        {runtimes.length === 0 && (
          <div style={{ fontSize: 13, color: M.textMuted, fontStyle: "italic", padding: "4px 0" }}>No runtimes</div>
        )}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: M.textMuted, textTransform: "uppercase", marginBottom: 10 }}>Services</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {allServices.map((s) => (
          <div key={s.uuid} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: M.card, borderRadius: 10, border: `1px solid ${M.border}` }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: M.teal, flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 500, color: M.textPrimary, flex: 1 }}>{s.serviceName}</span>
            <span style={{ fontSize: 11, color: M.textMuted }}>{s._rtName}</span>
            <MobileIcon name="chevronRight" size={13} color={M.textMuted} />
          </div>
        ))}
        {allServices.length === 0 && (
          <div style={{ fontSize: 13, color: M.textMuted, fontStyle: "italic", padding: "4px 0" }}>No services</div>
        )}
      </div>
    </div>
  );
}

// ── Settings tab ───────────────────────────────────────────────
function SettingsTab({ boardName, onSaveBoard }: { boardName: string; onSaveBoard?: () => void }) {
  const boardContext = useBoardContext();
  if (!boardContext) return null;
  const rtCount = boardContext.runtimes.length;
  const svcCount = Object.values(boardContext.services).flat().length;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: M.textMuted, textTransform: "uppercase", marginBottom: 10 }}>Board</div>
      <div style={{ background: M.card, borderRadius: 14, border: `1px solid ${M.border}`, overflow: "hidden" }}>
        {[
          ["Name", boardName || "Untitled"],
          ["Runtimes", String(rtCount)],
          ["Services", String(svcCount)],
        ].map(([k, v], i, a) => (
          <div key={k} style={{ display: "flex", alignItems: "center", padding: "13px 16px", borderBottom: i < a.length - 1 ? `1px solid ${M.border}` : "none" }}>
            <span style={{ fontSize: 14, color: M.textPrimary, flex: 1 }}>{k}</span>
            <span style={{ fontSize: 14, color: M.textMuted }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: M.textMuted, textTransform: "uppercase", margin: "20px 0 10px" }}>Actions</div>
      <button
        onClick={onSaveBoard}
        style={{ width: "100%", height: 46, border: "none", borderRadius: 14, background: M.teal, color: "#fff", fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 10 }}
      >
        Save Board
      </button>
    </div>
  );
}

// ── Tab bar button ─────────────────────────────────────────────
function TabButton({ label, icon, active, onClick }: { label: string; icon: MobileIconName; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, border: "none", background: "none", cursor: "pointer", padding: "4px 0" }}
    >
      <MobileIcon name={icon} size={22} color={active ? M.teal : M.textMuted} strokeWidth={active ? 2 : 1.6} />
      <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, color: active ? M.teal : M.textMuted }}>{label}</span>
    </button>
  );
}

// ── Top bar ────────────────────────────────────────────────────
function TopBar({ boardName, runtimeCount, serviceCount }: { boardName: string; runtimeCount: number; serviceCount: number }) {
  return (
    <div style={{ background: `rgba(242,237,232,0.92)`, backdropFilter: "blur(12px)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${M.border}`, flexShrink: 0 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <MobileIcon name="layers" size={16} color="#fff" strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: M.textPrimary, lineHeight: 1 }}>{boardName || "Untitled Board"}</div>
        <div style={{ fontSize: 11, color: M.textMuted, marginTop: 2 }}>{runtimeCount} runtime{runtimeCount !== 1 ? "s" : ""} · {serviceCount} service{serviceCount !== 1 ? "s" : ""}</div>
      </div>
      <button style={{ width: 34, height: 34, border: "none", background: "rgba(0,0,0,0.06)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
        <MobileIcon name="more" size={16} color={M.textSecondary} />
      </button>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────
export default function MobilePlaygroundInner({ suggestedName, onSaveBoard }: MobilePlaygroundInnerProps) {
  const boardContext = useBoardContext();
  const [tab, setTab] = useState<Tab>("board");
  const [showAddRuntime, setShowAddRuntime] = useState(false);
  const [addServiceRuntime, setAddServiceRuntime] = useState<RuntimeDescriptor | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceDescriptor | null>(null);
  const [selectedServiceRuntime, setSelectedServiceRuntime] = useState<RuntimeDescriptor | null>(null);

  if (!boardContext) {
    return null;
  }

  const { runtimes, services, registry, availableRuntimeEngines, boardName } = boardContext;
  const displayName = boardName || suggestedName || "Untitled Board";
  const rtCount = runtimes.length;
  const svcCount = Object.values(services).flat().length;

  const handleAddRuntime = (rtClass: RuntimeClass) => {
    boardContext.addRuntime({ ...rtClass, name: `${rtClass.name} ${runtimes.length + 1}` });
  };

  const handleAddService = (svc: ServiceClass) => {
    if (!addServiceRuntime) return;
    const runtime = runtimes.find((rt) => rt.id === addServiceRuntime.id);
    if (runtime) {
      boardContext.addService(svc, runtime);
    }
  };

  const handleRemoveService = (svc: ServiceDescriptor, rt: RuntimeDescriptor) => {
    boardContext.removeService({ uuid: svc.uuid }, rt);
  };

  const handleRenameService = (runtimeId: string, instanceId: string, name: string) => {
    boardContext.setServiceName(runtimeId, instanceId, name);
  };

  const handleRemoveRuntime = (rt: RuntimeDescriptor) => {
    boardContext.removeRuntime(rt);
  };

  const activeRegistry = addServiceRuntime ? (registry[addServiceRuntime.id] ?? []) : [];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: M.bg,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <TopBar boardName={displayName} runtimeCount={rtCount} serviceCount={svcCount} />

      {/* Dot-grid background for board tab */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          ...(tab === "board" ? {
            backgroundImage: "radial-gradient(circle, #c8c0b8 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          } : {}),
        }}
      >
        {tab === "board" && (
          <BoardTab
            onServiceTap={(svc, rt) => { setSelectedService(svc); setSelectedServiceRuntime(rt); }}
            activeServiceId={selectedService?.uuid ?? null}
            onAddService={setAddServiceRuntime}
            onRemoveRuntime={handleRemoveRuntime}
            onShowAddRuntime={() => setShowAddRuntime(true)}
          />
        )}
        {tab === "browser" && <BrowserTab />}
        {tab === "settings" && <SettingsTab boardName={displayName} onSaveBoard={onSaveBoard} />}
      </div>

      {/* Bottom tab bar */}
      <div style={{ background: "rgba(242,237,232,0.95)", backdropFilter: "blur(12px)", borderTop: `1px solid ${M.border}`, display: "flex", alignItems: "center", padding: "8px 0 16px", flexShrink: 0 }}>
        <TabButton label="Board" icon="home" active={tab === "board"} onClick={() => setTab("board")} />
        <TabButton label="Browser" icon="list" active={tab === "browser"} onClick={() => setTab("browser")} />
        <TabButton label="Settings" icon="settings" active={tab === "settings"} onClick={() => setTab("settings")} />
      </div>

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
        onClose={() => { setSelectedService(null); setSelectedServiceRuntime(null); }}
        service={selectedService}
        runtime={selectedServiceRuntime}
        onRemove={handleRemoveService}
        onRename={handleRenameService}
      />
    </div>
  );
}
