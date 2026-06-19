import { type CSSProperties, useEffect, useState } from "react";

import BottomSheet from "./BottomSheet";
import MobileIcon from "./MobileIcon";
import { M } from "./tokens";

type Props = {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (name: string) => void;
};

const inputStyle: CSSProperties = {
  width: "100%",
  border: `1px solid ${M.border}`,
  borderRadius: 10,
  padding: "12px",
  fontSize: 16, // >=16 prevents iOS auto-zoom on focus
  fontFamily: "inherit",
  fontWeight: 600,
  color: M.textPrimary,
  background: M.bg,
  outline: "none",
  boxSizing: "border-box",
};

export default function SaveBoardSheet({
  open,
  initialName,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(initialName);

  // Reset the field to the current board name each time the sheet opens.
  useEffect(() => {
    if (open) {
      setName(initialName);
    }
  }, [open, initialName]);

  const canSave = name.trim().length > 0;

  const onConfirm = () => {
    if (!canSave) {
      return;
    }
    onSave(name.trim());
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Save board" height="auto">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onConfirm();
            }
          }}
          placeholder="Board name"
          autoFocus
          spellCheck={false}
          style={inputStyle}
        />
        <button
          onClick={onConfirm}
          disabled={!canSave}
          style={{
            height: 48,
            border: "none",
            borderRadius: 12,
            background: canSave ? M.teal : M.borderStrong,
            color: "#fff",
            fontFamily: "inherit",
            fontSize: 15,
            fontWeight: 600,
            cursor: canSave ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <MobileIcon name="check" size={16} color="#fff" strokeWidth={2.2} />
          Save to this device
        </button>
      </div>
    </BottomSheet>
  );
}
