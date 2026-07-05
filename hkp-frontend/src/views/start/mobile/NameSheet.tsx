import { useEffect, useState } from "react";

import BottomSheet from "../../playground/mobile/BottomSheet";
import { M } from "../../playground/mobile/tokens";

/**
 * Bottom sheet asking for a name (new folder / new board inside a user
 * folder). Confirms via the primary button or the enter key.
 */
export default function NameSheet({
  open,
  title,
  placeholder,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  placeholder: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: (name: string) => void;
}) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
    }
  }, [open]);

  const confirm = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    onConfirm(trimmed);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={title} height="auto">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          paddingBottom: 8,
        }}
      >
        <input
          autoFocus
          value={name}
          placeholder={placeholder}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              confirm();
            }
          }}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            borderRadius: 12,
            border: `1px solid ${M.borderStrong}`,
            background: M.bg,
            color: M.textPrimary,
            // >= 16px so iOS Safari does not auto-zoom into the field.
            fontSize: 16,
            fontFamily: "inherit",
            outline: "none",
          }}
        />
        <button
          onClick={confirm}
          disabled={!name.trim()}
          style={{
            width: "100%",
            padding: "13px 14px",
            borderRadius: 12,
            border: "none",
            background: name.trim() ? M.teal : M.border,
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: name.trim() ? "pointer" : "default",
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </BottomSheet>
  );
}
