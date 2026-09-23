import { useEffect, useMemo, useRef, useState } from "react";
import {
  Monitor,
  Server,
  GitBranch,
  Package,
  Layers,
  GripVertical,
  Search,
  Settings,
} from "lucide-react";
import { useBoardContext } from "../../BoardContext";
import {
  RuntimeClass,
  RuntimeClassType,
  ServiceClassWithPreset,
  toCanonicalRuntimeClassType,
  toCanonicalServiceId,
  isRuntimeGraphQLClassType,
  isRuntimeRestClassType,
} from "../../types";
import { usePresetsForService } from "../../ui-components/service/usePresetsForService";
import {
  HKP_DND_RUNTIME_CLASS_TYPE,
  HKP_DND_SERVICE_CLASS_TYPE,
} from "../../components/DropTypes";
import ManageRuntimesDialog from "../../ui-components/toolbar/ManageRuntimesDialog";
import { useRemoteRuntimeEditing } from "../../ui-components/toolbar/useRemoteRuntimeEditing";
import { boardHasFacade, useFacadeView } from "../../facade/FacadeViewContext";
import { useSelection } from "../../selection/SelectionContext";

/** The service a composed preset is a preset *of*, canonically. */
const SUB_SERVICE_ID = "sub-service";

/** Distinct per card: one service can appear once plus once per preset of it. */
function paletteKey(svc: ServiceClassWithPreset): string {
  return svc.preset ? `${svc.serviceId}:${svc.preset.id}` : svc.serviceId;
}

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
  if (canonical === "graphql") {
    return <GitBranch size={size} />;
  }
  if (canonical === "rest") {
    return <Server size={size} />;
  }
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

function ServiceCard({ svc }: { svc: ServiceClassWithPreset }) {
  // A palette entry standing for a preset of a sub-service is a building block
  // made of other services. It is dragged and dropped like any primitive; the
  // icon is the only place it says what it is made of.
  const composed = !!svc.preset;
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
        {composed ? <Layers size={13} /> : <Package size={13} />}
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
  selectedFor,
  hiddenMatches,
  containerRef,
  onToggle,
}: {
  type: string;
  services: ServiceClassWithPreset[];
  open: boolean;
  /** Name of the selected runtime, when it is one this group serves. */
  selectedFor?: string;
  /** Folded away while a search is running, with matches inside it. */
  hiddenMatches?: boolean;
  containerRef?: (el: HTMLDivElement | null) => void;
  onToggle: () => void;
}) {
  const label = RUNTIME_TYPE_LABELS[type] ?? type;
  return (
    <div ref={containerRef}>
      <button
        type="button"
        onClick={onToggle}
        title={
          hiddenMatches
            ? `${services.length} more in ${label}`
            : selectedFor
              ? `Services for ${selectedFor}`
              : undefined
        }
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          padding: "5px 12px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: selectedFor ? "var(--hkp-accent)" : "var(--text-dim)",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        <ChevronIcon open={open} />
        {label}
        <span
          style={{
            marginLeft: "auto",
            fontWeight: 400,
            // A search reaches the whole palette, so a group folded away for
            // not being the selected one still says what it is holding.
            opacity: hiddenMatches ? 1 : 0.6,
            color: hiddenMatches ? "var(--hkp-accent)" : undefined,
          }}
        >
          {services.length}
        </span>
      </button>
      {open &&
        services.map((svc) => <ServiceCard key={paletteKey(svc)} svc={svc} />)}
    </div>
  );
}

/** Remembered height of the runtimes pane, in pixels. */
const RUNTIMES_HEIGHT_KEY = "hkp-sidebar-runtimes-height";

/** Enough of a pane to be worth having; below this the drag stops. */
const MIN_RUNTIMES_HEIGHT = 44;
const MIN_SERVICES_HEIGHT = 140;

/**
 * Drag handle between the runtimes pane and the services pane. Reports the
 * runtimes height the pointer implies; clamping and persistence are the
 * caller's business.
 */
function PaneSplitter({
  onResize,
  onCommit,
  onReset,
  heightOf,
  boundsOf,
}: {
  onResize: (height: number) => void;
  onCommit: () => void;
  onReset: () => void;
  /** The pane's height right now — a drag starts from what is on screen. */
  heightOf: () => number;
  /** How much room the two panes share, for the far end of the clamp. */
  boundsOf: () => number;
}) {
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);

  // While dragging, the whole document shows the resize cursor and stops
  // selecting text — the pointer regularly leaves the handle itself.
  useEffect(() => {
    if (!dragging) {
      return;
    }
    const { style } = document.body;
    const cursor = style.cursor;
    const select = style.userSelect;
    style.cursor = "ns-resize";
    style.userSelect = "none";
    return () => {
      style.cursor = cursor;
      style.userSelect = select;
    };
  }, [dragging]);

  const clamp = (height: number) =>
    Math.max(
      MIN_RUNTIMES_HEIGHT,
      Math.min(
        Math.max(MIN_RUNTIMES_HEIGHT, boundsOf() - MIN_SERVICES_HEIGHT),
        height,
      ),
    );

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = heightOf();
    setDragging(true);

    const move = (e: PointerEvent) => {
      onResize(clamp(startHeight + e.clientY - startY));
    };
    const stop = () => {
      setDragging(false);
      onCommit();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowUp" ? -12 : event.key === "ArrowDown" ? 12 : 0;
    if (!step) {
      return;
    }
    event.preventDefault();
    onResize(clamp(heightOf() + step));
    onCommit();
  };

  const lit = dragging || hovered;
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize runtimes and services"
      tabIndex={0}
      onPointerDown={startDrag}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      title="Drag to resize — double-click to reset"
      style={{
        height: 7,
        flexShrink: 0,
        cursor: "ns-resize",
        userSelect: "none",
        // The hairline lights up on hover / while dragging; the hit area
        // around it stays invisible.
        background: `linear-gradient(180deg, transparent 3px, ${
          lit ? "var(--hkp-accent)" : "var(--border-mid, #d1d5db)"
        } 3px, ${
          lit ? "var(--hkp-accent)" : "var(--border-mid, #d1d5db)"
        } 4px, transparent 4px)`,
      }}
    />
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});
  const [showManageRuntimes, setShowManageRuntimes] = useState(false);
  const boardContext = useBoardContext();
  const facadeView = useFacadeView();
  const selection = useSelection();
  const subServicePresets = usePresetsForService(SUB_SERVICE_ID);
  const paletteRef = useRef<HTMLDivElement | null>(null);
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const runtimesRef = useRef<HTMLDivElement | null>(null);

  // How tall the runtimes pane was left. Unset means it sizes itself to its
  // cards, which is the right answer until someone says otherwise.
  const [runtimesHeight, setRuntimesHeight] = useState<number | null>(() => {
    const stored = parseInt(
      localStorage.getItem(RUNTIMES_HEIGHT_KEY) ?? "",
      10,
    );
    return stored > 0 ? stored : null;
  });

  const availableRuntimes = boardContext?.availableRuntimeEngines ?? [];

  const serviceGroups = useMemo(() => {
    if (!boardContext) {
      return [];
    }
    const typeMap = new Map<string, ServiceClassWithPreset[]>();
    for (const runtime of boardContext.runtimes) {
      const canonical = toCanonicalRuntimeClassType(runtime.type);
      const services = boardContext.registry[runtime.id] ?? [];
      if (!typeMap.has(canonical)) {
        typeMap.set(canonical, []);
      }
      const group = typeMap.get(canonical)!;
      for (const svc of services) {
        if (!group.some((s) => s.serviceId === svc.serviceId)) {
          group.push(svc);
        }
      }
    }

    // A sub-service preset is a pipeline someone built and kept, which is a
    // building block in exactly the way a primitive is: it belongs in the
    // palette rather than behind a menu on a service you have to add first.
    // Offered only where the runtime has a sub-service to put it in, and only
    // where the preset says it belongs — its nested services are named by ids
    // that one runtime's registry has and another's may not.
    for (const [type, group] of typeMap.entries()) {
      const host = group.find(
        (svc) => toCanonicalServiceId(svc.serviceId) === SUB_SERVICE_ID,
      );
      if (!host) {
        continue;
      }
      for (const preset of subServicePresets) {
        if (
          preset.runtimes?.length &&
          !preset.runtimes.some(
            (rt) =>
              toCanonicalRuntimeClassType(rt as RuntimeClassType) === type,
          )
        ) {
          continue;
        }
        group.push({
          // The card is the preset, so it is called what the preset is called.
          // `serviceName` is the name a preset gives a service it is *applied*
          // to, and one captured from a service carries whatever that service
          // was called — "SubService", beside the SubService primitive.
          serviceId: host.serviceId,
          serviceName: preset.name,
          description: preset.description,
          version: host.version,
          capabilities: host.capabilities,
          preset: { id: preset.id, serviceId: preset.serviceId },
        });
      }
    }

    return Array.from(typeMap.entries()).map(([type, services]) => ({
      type,
      services,
    }));
  }, [boardContext?.runtimes, boardContext?.registry, subServicePresets]);

  const hasRuntimes = (boardContext?.runtimes.length ?? 0) > 0;

  // The runtime the board canvas is aimed at, if it is still on the board: what
  // it can run decides which part of the palette is worth looking at.
  const selectedRuntime = boardContext?.runtimes.find(
    (rt) => rt.id === selection?.selectedRuntimeId,
  );
  const selectedType = selectedRuntime
    ? toCanonicalRuntimeClassType(selectedRuntime.type)
    : null;

  // A new selection re-decides which groups are open — the one holding its
  // services, and no other — so whatever was opened or folded by hand for the
  // runtime before it is let go rather than carried over.
  useEffect(() => {
    setGroupOpen({});
  }, [selectedType]);

  // Reaching for a service should not begin with a scroll. Folding the other
  // groups away usually puts the right one on screen by itself, so this moves
  // the service list only when the group is somewhere it cannot be seen.
  useEffect(() => {
    if (!open || !selectedType) {
      return;
    }
    const palette = paletteRef.current;
    const group = groupRefs.current[selectedType];
    if (!palette || !group) {
      return;
    }
    const top = group.offsetTop - palette.offsetTop;
    const onScreen =
      top >= palette.scrollTop &&
      top < palette.scrollTop + palette.clientHeight;
    if (!onScreen) {
      palette.scrollTo?.({ top, behavior: "smooth" });
    }
  }, [selectedType, open, serviceGroups]);

  // A drag is remembered only once it ends: the pane follows the pointer, the
  // stored height is what it was let go at.
  const runtimesHeightRef = useRef(runtimesHeight);
  runtimesHeightRef.current = runtimesHeight;

  const commitRuntimesHeight = () => {
    const height = runtimesHeightRef.current;
    if (height !== null) {
      localStorage.setItem(RUNTIMES_HEIGHT_KEY, String(Math.round(height)));
    }
  };

  const resetRuntimesHeight = () => {
    localStorage.removeItem(RUNTIMES_HEIGHT_KEY);
    setRuntimesHeight(null);
  };

  // A runtime someone just put on the board is the one they are working on, so
  // the palette moves to its services rather than making them say so again.
  const addRuntime = async (rtClass: RuntimeClass) => {
    if (!boardContext) {
      return;
    }
    const added = await boardContext.addRuntime({
      ...rtClass,
      name: `${rtClass.name} ${boardContext.runtimes.length + 1}`,
    });
    if (added) {
      selection?.selectRuntime(added.id);
    }
  };

  const {
    onAdd: onAddRuntimeEngine,
    onRemove: onRemoveRuntimeEngine,
    onUpdate: onUpdateRuntimeEngine,
  } = useRemoteRuntimeEditing();

  const remoteRuntimes = availableRuntimes.filter(
    (rt) =>
      isRuntimeGraphQLClassType(rt.type) || isRuntimeRestClassType(rt.type),
  );

  const query = search.trim().toLowerCase();

  const filteredGroups = useMemo(() => {
    if (!query) {
      return serviceGroups;
    }
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

  // A selected runtime folds the groups it cannot run down to their headers:
  // what is left is the palette for that runtime, with the search field a row
  // away rather than a scroll away. A search that finds nothing in the selected
  // group unfolds the rest, so looking for a service never ends in a palette
  // that shows none of what it found.
  const searchMissesSelection =
    !!query && !filteredGroups.some(({ type }) => type === selectedType);
  const groupOpenByDefault = (type: string) =>
    !selectedType || searchMissesSelection || type === selectedType;

  const isGroupOpen = (type: string) =>
    groupOpen[type] ?? groupOpenByDefault(type);

  const toggleGroup = (type: string) => {
    setGroupOpen((prev) => ({ ...prev, [type]: !isGroupOpen(type) }));
  };

  // The facade is what a board looks like to someone using it rather than
  // building it, so on its own it gets the window: nothing here — runtimes to
  // start, services to drag onto them — acts on what is then on screen. A host
  // that mounts no view state (the cloud view) keeps the sidebar throughout.
  if (
    facadeView &&
    !facadeView.showRuntime &&
    (boardHasFacade(boardContext) || facadeView.editorOpen)
  ) {
    return null;
  }

  const cogButton = (
    <button
      type="button"
      onClick={() => setShowManageRuntimes(true)}
      title="Manage runtime servers"
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
          width: open ? 220 : "fit-content",
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

        {/* Palette body: runtimes and services scroll independently, so the
            runtimes stay reachable however long the service palette is. */}
        <div
          ref={bodyRef}
          style={{
            display: open ? "flex" : "none",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {/* ── Runtimes ── */}
          <SectionLabel action={cogButton}>Runtimes</SectionLabel>
          <div
            ref={runtimesRef}
            style={{
              // Left alone it takes only the room it needs, gives it up first
              // when the window is short, and never grows past a third of the
              // sidebar. A height dragged onto it is kept instead, still
              // leaving the services pane room to be a pane.
              flex: runtimesHeight === null ? "0 1 auto" : "0 0 auto",
              height: runtimesHeight ?? undefined,
              minHeight: 0,
              maxHeight:
                runtimesHeight === null
                  ? "33%"
                  : `calc(100% - ${MIN_SERVICES_HEIGHT}px)`,
              overflowY: "auto",
            }}
          >
            {availableRuntimes.length === 0 && (
              <EmptyHint>No runtime servers configured</EmptyHint>
            )}
            {availableRuntimes.map((rtClass, i) => (
              <RuntimeCard
                key={`${rtClass.type}-${i}`}
                rtClass={rtClass}
                onAdd={() => addRuntime(rtClass)}
              />
            ))}
          </div>

          <PaneSplitter
            heightOf={() =>
              runtimesHeight ??
              runtimesRef.current?.getBoundingClientRect().height ??
              0
            }
            boundsOf={() => bodyRef.current?.clientHeight ?? 0}
            onResize={setRuntimesHeight}
            onCommit={commitRuntimesHeight}
            onReset={resetRuntimesHeight}
          />

          {/* ── Services ── */}
          <SectionLabel>Services</SectionLabel>
          {!hasRuntimes && (
            <EmptyHint>Add a runtime to browse services</EmptyHint>
          )}
          {hasRuntimes && (
            <div style={{ padding: "2px 8px 6px", flexShrink: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
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
          <div
            ref={paletteRef}
            style={{
              flex: "1 1 auto",
              minHeight: 0,
              overflowY: "auto",
              // Keep final palette items fully visible above the fixed footer.
              paddingBottom:
                "calc(12px + 36px + env(safe-area-inset-bottom, 0px))",
            }}
          >
            {hasRuntimes && filteredGroups.length === 0 && query && (
              <EmptyHint>{`No services match "${query}"`}</EmptyHint>
            )}
            {filteredGroups.map(({ type, services }) =>
              serviceGroups.length > 1 ? (
                <ServiceGroup
                  key={type}
                  type={type}
                  services={services}
                  open={isGroupOpen(type)}
                  selectedFor={
                    type === selectedType ? selectedRuntime?.name : undefined
                  }
                  hiddenMatches={!!query && !isGroupOpen(type)}
                  containerRef={(el) => {
                    groupRefs.current[type] = el;
                  }}
                  onToggle={() => toggleGroup(type)}
                />
              ) : (
                services.map((svc) => (
                  <ServiceCard key={paletteKey(svc)} svc={svc} />
                ))
              ),
            )}
          </div>
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
