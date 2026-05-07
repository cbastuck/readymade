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

export default function AddServiceSheet({ open, onClose, runtime, registry, onAdd }: Props) {
  return (
    <BottomSheet open={open} onClose={onClose} title={runtime ? `Add Service to ${runtime.name}` : "Add Service"} height="65%">
      {registry.length === 0 ? (
        <div style={{ color: M.textMuted, fontSize: 14, textAlign: "center", paddingTop: 24 }}>
          No services available for this runtime.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {registry.map((svc) => (
            <button
              key={svc.serviceId}
              onClick={() => { onAdd(svc); onClose(); }}
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
              <div style={{ width: 40, height: 40, borderRadius: 10, background: M.tealLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <MobileIcon name="package" size={20} color={M.tealDark} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: M.textPrimary }}>{svc.serviceName}</div>
                {svc.description && (
                  <div style={{ fontSize: 12, color: M.textMuted, marginTop: 2 }}>{svc.description}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
