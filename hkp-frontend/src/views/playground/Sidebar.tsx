import { useMemo, useState } from "react";
import {
  Monitor,
  Server,
  GitBranch,
  Package,
  GripVertical,
  Search,
  Settings,
} from "lucide-react";
import { useBoardContext } from "../../BoardContext";
import {
  RuntimeClass,
  ServiceClass,
  toCanonicalRuntimeClassType,
  isRuntimeGraphQLClassType,
  isRuntimeRestClassType,
} from "../../types";
import {
  HKP_DND_RUNTIME_CLASS_TYPE,
  HKP_DND_SERVICE_CLASS_TYPE,
} from "../../components/DropTypes";
import ManageRuntimesDialog from "../../ui-components/toolbar/ManageRuntimesDialog";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      style={{
        transform: open ? "rotate(0deg)" : "rotate(-90deg)",
        transition: "transform 0.18s ease",
      }}
    >
      <path d="M2.5 4.5l3.5 3 3.5-3" />
    </svg>
  );
}

function RuntimeTypeIcon({ type }: { type: string }) {
  const canonical = toCanonicalRuntimeClassType(type as any);
  const size = 14;
  if (canonical === "graphql") return <GitBranch size={size} />;
  if (canonical === "rest") return <Server size={size} />;
  return <Monitor size={size} />;
}

const RUNTIME_TYPE_LABELS: Record<string, string> = {
  browser: "Browser",
  graphql: "GraphQL",
  rest: "REST",
};

function RuntimeCard({
  rtClass,
  onAdd,
}: {
  rtClass: RuntimeClass;
  onAdd: () => void;
}) {
  const canonical = toCanonicalRuntimeClassType(rtClass.type);
  const label = RUNTIME_TYPE_LABELS[canonical] ?? rtClass.type;

  return (
    <div
      draggable
      onDragStart={(ev) =>
        ev.dataTransfer.setData(
          HKP_DND_RUNTIME_CLASS_TYPE,
          JSON.stringify(rtClass),
        )
      }
      className="hkp-palette-card"
      onClick={onAdd}
      title={`Click or drag to add a ${rtClass.name} runtime`}
    >
      <div className="hkp-palette-card-icon">
        <RuntimeTypeIcon type={rtClass.type} />
      </div>
      <div className="hkp-palette-card-body">
        <div className="hkp-palette-card-name">{rtClass.name}</div>
        <div className="hkp-palette-card-sub">{label}</div>
      </div>
      <div className="hkp-palette-card-drag-handle">
        <GripVertical size={12} />
      </div>
    </div>
  );
}

function ServiceCard({ svc }: { svc: ServiceClass }) {
  return (
    <div
      draggable
      onDragStart={(ev) =>
        ev.dataTransfer.setData(HKP_DND_SERVICE_CLASS_TYPE, JSON.stringify(svc))
      }
      className="hkp-palette-card"
      title={svc.description ?? `Drag to a runtime to add ${svc.serviceName}`}
    >
      <div
        className="hkp-palette-card-icon"
        style={{ color: "var(--text-dim)" }}
      >
        <Package size={13} />
      </div>
      <div className="hkp-palette-card-body">
        <div className="hkp-palette-card-name">{svc.serviceName}</div>
        {svc.description && (
          <div className="hkp-palette-card-desc">{svc.description}</div>
        )}
      </div>
      <div className="hkp-palette-card-drag-handle">
        <GripVertical size={12} />
      </div>
    </div>
  );
}

function SectionLabel({
  children,
  action,
}: {
  children: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 12px 4px",
      }}
    >
      <span
        style={{
          flex: 1,
          fontSize: 11.5,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-dim, #9ca3af)",
        }}
      >
        {children}
      </span>
      {action}
    </div>
  );
}

function EmptyHint({ children }: { children: string }) {
  return (
    <div
      style={{
        padding: "2px 12px 6px",
        fontSize: 11.5,
        color: "var(--text-dim, #9ca3af)",
        fontStyle: "italic",
      }}
    >
      {children}
    </div>
  );
}

function ServiceGroup({
  type,
  services,
  open,
  onToggle,
}: {
  type: string;
  services: ServiceClass[];
  open: boolean;
  onToggle: () => void;
}) {
  const label = RUNTIME_TYPE_LABELS[type] ?? type;
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          padding: "5px 12px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text-dim)",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        <ChevronIcon open={open} />
        {label}
        <span style={{ marginLeft: "auto", fontWeight: 400, opacity: 0.6 }}>
          {services.length}
        </span>
      </button>
      {open &&
        services.map((svc) => <ServiceCard key={svc.serviceId} svc={svc} />)}
    </div>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});
  const [showManageRuntimes, setShowManageRuntimes] = useState(false);
  const boardContext = useBoardContext();

  const availableRuntimes = boardContext?.availableRuntimeEngines ?? [];

  const serviceGroups = useMemo(() => {
    if (!boardContext) return [];
    const typeMap = new Map<string, ServiceClass[]>();
    for (const runtime of boardContext.runtimes) {
      const canonical = toCanonicalRuntimeClassType(runtime.type);
      const services = boardContext.registry[runtime.id] ?? [];
      if (!typeMap.has(canonical)) typeMap.set(canonical, []);
      const group = typeMap.get(canonical)!;
      for (const svc of services) {
        if (!group.some((s) => s.serviceId === svc.serviceId)) {
          group.push(svc);
        }
      }
    }
    return Array.from(typeMap.entries()).map(([type, services]) => ({
      type,
      services,
    }));
  }, [boardContext?.runtimes, boardContext?.registry]);

  const hasRuntimes = (boardContext?.runtimes.length ?? 0) > 0;

  const addRuntime = (rtClass: RuntimeClass) => {
    if (!boardContext) return;
    boardContext.addRuntime({
      ...rtClass,
      name: `${rtClass.name} ${boardContext.runtimes.length + 1}`,
    });
  };

  const persistRemoteRuntimes = (allEngines: RuntimeClass[]) => {
    const remote = allEngines.filter(
      (rt) =>
        isRuntimeGraphQLClassType(rt.type) || isRuntimeRestClassType(rt.type),
    );
    localStorage.setItem("available-remote-runtimes", JSON.stringify(remote));
  };

  const onAddRuntimeEngine = (desc: RuntimeClass) => {
    const updated = boardContext?.addAvailableRuntime(desc, false) ?? [];
    persistRemoteRuntimes(updated);
  };

  const onRemoveRuntimeEngine = (desc: RuntimeClass) => {
    const updated = boardContext?.removeAvailableRuntime(desc) ?? [];
    persistRemoteRuntimes(updated);
  };

  const onUpdateRuntimeEngine = (desc: RuntimeClass) => {
    const updated = boardContext?.addAvailableRuntime(desc, true) ?? [];
    persistRemoteRuntimes(updated);
  };

  const remoteRuntimes = availableRuntimes.filter(
    (rt) =>
      isRuntimeGraphQLClassType(rt.type) || isRuntimeRestClassType(rt.type),
  );

  const toggleGroup = (type: string) => {
    setGroupOpen((prev) => ({ ...prev, [type]: !(prev[type] ?? true) }));
  };

  const isGroupOpen = (type: string) => groupOpen[type] ?? true;

  const query = search.trim().toLowerCase();

  const filteredGroups = useMemo(() => {
    if (!query) return serviceGroups;
    return serviceGroups
      .map(({ type, services }) => ({
        type,
        services: services.filter(
          (s) =>
            s.serviceName.toLowerCase().includes(query) ||
            s.description?.toLowerCase().includes(query),
        ),
      }))
      .filter(({ services }) => services.length > 0);
  }, [serviceGroups, query]);

  const cogButton = (
    <button
      type="button"
      onClick={() => setShowManageRuntimes(true)}
      title="Manage runtime engines"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 20,
        height: 20,
        background: "none",
        border: "none",
        borderRadius: 4,
        cursor: "pointer",
        color: "var(--text-dim)",
        padding: 0,
        flexShrink: 0,
      }}
      className="hkp-sidebar-cog"
    >
      <Settings size={15} />
    </button>
  );

  return (
    <>
      <div
        className="hkp-sidebar"
        style={{
          width: open ? 220 : 46,
          transition: "width 0.22s ease",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid var(--border-mid, #d1d5db)",
          background: "var(--bg-app, white)",
          overflow: "hidden",
          userSelect: "none",
        }}
      >
        {/* Header / collapse toggle */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 12px",
            height: 26,
            width: "100%",
            background: "none",
            border: "none",
            // borderBottom: "1px solid var(--border-mid, #d1d5db)",
            cursor: "pointer",
            color: "var(--text-dim, #9ca3af)",
            flexShrink: 0,
          }}
        >
          {open && (
            <span
              style={{
                fontSize: 11.0,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Building Blocks
            </span>
          )}
          <ChevronIcon open={open} />
        </button>

        {/* Palette body */}
        <div
          style={{
            display: open ? "flex" : "none",
            flexDirection: "column",
            flex: 1,
            overflowY: "auto",
            // Keep final palette items fully visible above the fixed footer.
            paddingBottom:
              "calc(12px + 36px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {/* ── Runtimes ── */}
          <SectionLabel action={cogButton}>Runtimes</SectionLabel>
          {availableRuntimes.length === 0 && (
            <EmptyHint>No runtime engines configured</EmptyHint>
          )}
          {availableRuntimes.map((rtClass, i) => (
            <RuntimeCard
              key={`${rtClass.type}-${i}`}
              rtClass={rtClass}
              onAdd={() => addRuntime(rtClass)}
            />
          ))}

          {/* ── Services ── */}
          <SectionLabel>Services</SectionLabel>
          {!hasRuntimes && (
            <EmptyHint>Add a runtime to browse services</EmptyHint>
          )}
          {hasRuntimes && (
            <div style={{ padding: "2px 8px 6px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "var(--border, #f3f0eb)",
                  borderRadius: 7,
                  padding: "4px 8px",
                }}
              >
                <Search
                  size={11}
                  style={{ color: "var(--text-dim)", flexShrink: 0 }}
                />
                <input
                  type="text"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="border rounded px-2 py-0.5"
                  style={{
                    background: "none",
                    outline: "none",
                    fontSize: 12,
                    color: "var(--text)",
                    width: "100%",
                  }}
                  spellCheck={false}
                />
              </div>
            </div>
          )}
          {hasRuntimes && filteredGroups.length === 0 && query && (
            <EmptyHint>{`No services match "${query}"`}</EmptyHint>
          )}
          {filteredGroups.map(({ type, services }) =>
            serviceGroups.length > 1 ? (
              <ServiceGroup
                key={type}
                type={type}
                services={services}
                open={!!query || isGroupOpen(type)}
                onToggle={() => toggleGroup(type)}
              />
            ) : (
              services.map((svc) => (
                <ServiceCard key={svc.serviceId} svc={svc} />
              ))
            ),
          )}
        </div>
      </div>

      <ManageRuntimesDialog
        remoteRuntimes={remoteRuntimes}
        isOpen={showManageRuntimes}
        onClose={() => setShowManageRuntimes(false)}
        onAddRuntimeEngine={onAddRuntimeEngine}
        onRemoveRuntimeEngine={onRemoveRuntimeEngine}
        onUpdateRuntimeEngine={onUpdateRuntimeEngine}
      />
    </>
  );
}
