import { useMemo, useState } from "react";
import BottomSheet from "./BottomSheet";
import MobileIcon, { type MobileIconName } from "./MobileIcon";
import { M } from "./tokens";
import { ServiceClassWithPreset, RuntimeDescriptor } from "../../../types";
import { paletteKey } from "../../../core/palette";

type Props = {
  open: boolean;
  onClose: () => void;
  runtime: RuntimeDescriptor | null;
  /**
   * What can be added: the runtime's services, and — where the caller offers
   * them (`core/palette`) — the board's blocks and the building blocks kept on
   * this device. `addService` knows what each one stands for.
   */
  registry: ServiceClassWithPreset[];
  onAdd: (svc: ServiceClassWithPreset) => void;
};

type Kind = "block" | "preset" | "service";

/**
 * A use of a block — of this board, or one from the library adding it copies
 * in — is a reference; a composed preset is a copy of a pipeline someone kept.
 */
function kindOf(svc: ServiceClassWithPreset): Kind {
  if (svc.block || svc.preset?.use) {
    return "block";
  }
  return svc.preset ? "preset" : "service";
}

/**
 * What the sheet shows at a time. Services and building blocks are looked for
 * for different reasons, and a board with many blocks would otherwise put a
 * long scroll between the sheet's top and its services.
 */
type Tab = "services" | "blocks";

const tabOf = (svc: ServiceClassWithPreset): Tab =>
  kindOf(svc) === "service" ? "services" : "blocks";

const TABS: { tab: Tab; label: string }[] = [
  { tab: "services", label: "Services" },
  { tab: "blocks", label: "Building Blocks" },
];

const SECTIONS: { kind: Kind; title: string; icon: MobileIconName }[] = [
  { kind: "block", title: "Blocks", icon: "boxes" },
  { kind: "preset", title: "Presets", icon: "layers" },
  { kind: "service", title: "Services", icon: "package" },
];

export default function AddServiceSheet({
  open,
  onClose,
  runtime,
  registry,
  onAdd,
}: Props) {
  const [query, setQuery] = useState("");
  // Services first: what is added most often.
  const [tab, setTab] = useState<Tab>("services");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return registry;
    }
    return registry.filter(
      (svc) =>
        svc.serviceName.toLowerCase().includes(q) ||
        (svc.description?.toLowerCase().includes(q) ?? false),
    );
  }, [registry, query]);
  // A runtime offering services alone needs no switcher.
  const onlyServices = registry.every((svc) => kindOf(svc) === "service");
  const activeTab: Tab = onlyServices ? "services" : tab;
  const shown = filtered.filter((svc) => tabOf(svc) === activeTab);
  const otherTab = TABS.find((entry) => entry.tab !== activeTab)!;
  const elsewhere = filtered.length - shown.length;
  // Within a tab, headings only where it holds more than one kind.
  const kindsShown = new Set(
    registry.filter((svc) => tabOf(svc) === activeTab).map(kindOf),
  );

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        setQuery("");
        setTab("services");
        onClose();
      }}
      title={runtime ? `Add Service to ${runtime.name}` : "Add Service"}
      height="65%"
    >
      {registry.length === 0 ? (
        <div
          style={{
            color: M.textMuted,
            fontSize: 14,
            textAlign: "center",
            paddingTop: 24,
          }}
        >
          No services available for this runtime.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!onlyServices && (
            <div
              role="tablist"
              aria-label="What to add"
              style={{
                display: "flex",
                background: M.bg,
                borderRadius: 10,
                padding: 3,
                gap: 2,
              }}
            >
              {TABS.map((entry) => {
                const active = entry.tab === activeTab;
                const count = filtered.filter((svc) => tabOf(svc) === entry.tab).length;
                return (
                  <button
                    key={entry.tab}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(entry.tab)}
                    style={{
                      flex: 1,
                      height: 34,
                      border: "none",
                      borderRadius: 8,
                      background: active ? M.card : "transparent",
                      boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                      color: active ? M.textPrimary : M.textSecondary,
                      fontFamily: "inherit",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {entry.label}{" "}
                    <span style={{ color: M.textMuted, fontWeight: 500 }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ position: "relative", marginBottom: 4 }}>
            <div
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
              }}
            >
              <MobileIcon name="search" size={18} color={M.textMuted} />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                activeTab === "services"
                  ? "Search services…"
                  : "Search building blocks…"
              }
              autoFocus
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "11px 12px 11px 38px",
                border: `1.5px solid ${M.border}`,
                borderRadius: 12,
                background: M.card,
                fontSize: 16,
                color: M.textPrimary,
                outline: "none",
              }}
              spellCheck={false}
            />
          </div>
          {shown.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                color: M.textMuted,
                fontSize: 14,
                textAlign: "center",
                paddingTop: 24,
              }}
            >
              {query.trim()
                ? `No ${activeTab === "services" ? "services" : "building blocks"} match “${query.trim()}”.`
                : "Nothing here for this runtime yet."}
              {elsewhere > 0 && (
                <button
                  onClick={() => setTab(otherTab.tab)}
                  style={{
                    border: "none",
                    background: "none",
                    color: M.tealDark,
                    fontFamily: "inherit",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Show {elsewhere} in {otherTab.label}
                </button>
              )}
            </div>
          ) : (
            SECTIONS.map(({ kind, title, icon }) => {
              const entries = shown.filter((svc) => kindOf(svc) === kind);
              if (entries.length === 0) {
                return null;
              }
              return (
                <div
                  key={kind}
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {kindsShown.size > 1 && (
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        color: M.textMuted,
                        textTransform: "uppercase",
                        marginTop: 8,
                      }}
                    >
                      {title}
                    </div>
                  )}
                  {entries.map((svc) => (
                    <button
                      key={paletteKey(svc)}
                      onClick={() => {
                        onAdd(svc);
                        setQuery("");
                        onClose();
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 14px",
                        border: `1.5px solid ${kind === "service" ? M.border : M.runtimeBorder}`,
                        borderRadius: 12,
                        background: M.card,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background:
                            kind === "service" ? M.tealLight : M.blueLight,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <MobileIcon
                          name={icon}
                          size={20}
                          color={kind === "service" ? M.tealDark : M.blue}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: M.textPrimary,
                          }}
                        >
                          {svc.serviceName}
                        </div>
                        {svc.description && (
                          <div
                            style={{
                              fontSize: 12,
                              color: M.textMuted,
                              marginTop: 2,
                            }}
                          >
                            {svc.description}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </BottomSheet>
  );
}
