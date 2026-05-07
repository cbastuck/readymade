import BottomSheet from "./BottomSheet";
import MobileIcon, { type MobileIconName } from "./MobileIcon";
import { M } from "./tokens";
import { RuntimeClass, toCanonicalRuntimeClassType } from "../../../types";

const RUNTIME_TYPE_ICON: Record<string, MobileIconName> = {
  browser: "monitor",
  graphql: "gitBranch",
  rest: "server",
};

type Props = {
  open: boolean;
  onClose: () => void;
  availableEngines: RuntimeClass[];
  onAdd: (rtClass: RuntimeClass) => void;
};

export default function AddRuntimeSheet({ open, onClose, availableEngines, onAdd }: Props) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Add Runtime" height="55%">
      {availableEngines.length === 0 ? (
        <div style={{ color: M.textMuted, fontSize: 14, textAlign: "center", paddingTop: 24 }}>
          No runtime engines available.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {availableEngines.map((rt, i) => {
            const canonical = toCanonicalRuntimeClassType(rt.type);
            const iconName: MobileIconName = RUNTIME_TYPE_ICON[canonical] ?? "cpu";
            return (
              <button
                key={i}
                onClick={() => { onAdd(rt); onClose(); }}
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
                <div style={{ width: 40, height: 40, borderRadius: 10, background: M.blueLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <MobileIcon name={iconName} size={20} color={M.blue} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: M.textPrimary }}>{rt.name}</div>
                  <div style={{ fontSize: 12, color: M.textMuted, marginTop: 2 }}>{canonical}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}
