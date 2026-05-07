import { useState } from "react";
import BottomSheet from "./BottomSheet";
import MobileIcon from "./MobileIcon";
import { M } from "./tokens";
import { ServiceDescriptor, RuntimeDescriptor } from "../../../types";

type Props = {
  open: boolean;
  onClose: () => void;
  service: ServiceDescriptor | null;
  runtime: RuntimeDescriptor | null;
  onRemove: (service: ServiceDescriptor, runtime: RuntimeDescriptor) => void;
  onRename: (runtimeId: string, instanceId: string, name: string) => void;
};

export default function ServiceSheet({ open, onClose, service, runtime, onRemove, onRename }: Props) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  const handleNameSubmit = () => {
    if (service && runtime && nameValue.trim()) {
      onRename(runtime.id, service.uuid, nameValue.trim());
    }
    setEditingName(false);
  };

  const handleOpen = () => {
    setNameValue(service?.serviceName ?? "");
    setEditingName(false);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={service?.serviceName ?? "Service"} height="60%">
      {service && runtime && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} onFocus={() => !nameValue && handleOpen()}>
          {/* Name row */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: M.textMuted, textTransform: "uppercase", marginBottom: 8 }}>Name</div>
            {editingName ? (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  autoFocus
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleNameSubmit(); if (e.key === "Escape") setEditingName(false); }}
                  style={{ flex: 1, height: 44, border: `1.5px solid ${M.teal}`, borderRadius: 10, padding: "0 12px", fontFamily: "inherit", fontSize: 15, color: M.textPrimary, background: M.card, outline: "none" }}
                />
                <button onClick={handleNameSubmit} style={{ width: 44, height: 44, border: "none", borderRadius: 10, background: M.teal, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MobileIcon name="check" size={18} color="#fff" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setNameValue(service.serviceName); setEditingName(true); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "12px 14px", background: "#f8f5f2", border: `1px solid ${M.border}`, borderRadius: 10, cursor: "pointer", textAlign: "left" }}
              >
                <span style={{ flex: 1, fontSize: 15, color: M.textPrimary }}>{service.serviceName}</span>
                <MobileIcon name="chevronRight" size={14} color={M.textMuted} />
              </button>
            )}
          </div>

          {/* Service ID */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: M.textMuted, textTransform: "uppercase", marginBottom: 8 }}>Service ID</div>
            <div style={{ padding: "10px 14px", background: "#f8f5f2", borderRadius: 10, border: `1px solid ${M.border}` }}>
              <span style={{ fontSize: 12, color: M.textSecondary, fontFamily: "monospace", wordBreak: "break-all" }}>{service.serviceId}</span>
            </div>
          </div>

          {/* Runtime */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: M.textMuted, textTransform: "uppercase", marginBottom: 8 }}>Runtime</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: M.blueLight, border: `1px solid ${M.runtimeBorder}`, borderRadius: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: M.blue }} />
              <span style={{ fontSize: 14, color: M.textPrimary }}>{runtime.name}</span>
            </div>
          </div>

          {/* State preview */}
          {service.state !== undefined && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: M.textMuted, textTransform: "uppercase", marginBottom: 8 }}>Current State</div>
              <div style={{ padding: "10px 14px", background: "#f8f5f2", borderRadius: 10, border: `1px solid ${M.border}`, maxHeight: 120, overflowY: "auto" }}>
                <pre style={{ fontSize: 11, color: M.textSecondary, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {JSON.stringify(service.state, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Remove */}
          <button
            onClick={() => { onRemove(service, runtime); onClose(); }}
            style={{ height: 46, border: `1.5px solid ${M.danger}`, borderRadius: 12, background: "#fff5f5", color: M.danger, fontFamily: "inherit", fontSize: 15, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 }}
          >
            <MobileIcon name="trash" size={16} color={M.danger} />
            Remove Service
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
