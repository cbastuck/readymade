import { useMemo, useState } from "react";
import BottomSheet from "./BottomSheet";
import MobileIcon from "./MobileIcon";
import { M } from "./tokens";
import { ServiceClass, RuntimeDescriptor } from "../../../types";

type Props = {
  open: boolean;
  onClose: () => void;
  runtime: RuntimeDescriptor | null;
  registry: ServiceClass[];
  onAdd: (svc: ServiceClass) => void;
};

export default function AddServiceSheet({
  open,
  onClose,
  runtime,
  registry,
  onAdd,
}: Props) {
  const [query, setQuery] = useState("");

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

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        setQuery("");
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
              placeholder="Search services…"
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
          {filtered.length === 0 ? (
            <div
              style={{
                color: M.textMuted,
                fontSize: 14,
                textAlign: "center",
                paddingTop: 24,
              }}
            >
              No services match “{query.trim()}”.
            </div>
          ) : (
            filtered.map((svc) => (
              <button
                key={svc.serviceId}
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
                  border: `1.5px solid ${M.border}`,
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
                    background: M.tealLight,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <MobileIcon name="package" size={20} color={M.tealDark} />
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
                      style={{ fontSize: 12, color: M.textMuted, marginTop: 2 }}
                    >
                      {svc.description}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </BottomSheet>
  );
}
