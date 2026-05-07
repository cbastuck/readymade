import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";

type Props = {
  suggestedName: string;
  suggestedDescription: string;
  isOpen: boolean;
  onSave: (name: string, description: string, isSuggestedName: boolean) => void;
  onCancel: () => void;
};

const fieldLabel: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-dim, #9a9590)",
  marginBottom: 5,
  display: "block",
};

const inputBase: React.CSSProperties = {
  width: "100%",
  fontFamily: "'DM Sans', system-ui, sans-serif",
  fontSize: 13,
  fontWeight: 400,
  background: "oklch(0.965 0.005 62)",
  border: "1.5px solid var(--border, #e2ddd7)",
  borderRadius: 6,
  padding: "6px 9px",
  color: "var(--text, #1a1a1a)",
  outline: "none",
  boxSizing: "border-box",
};

export default function SaveBoardDialog({
  suggestedName,
  suggestedDescription,
  isOpen,
  onSave,
  onCancel,
}: Props) {
  const [name, setName] = useState(suggestedName);
  const [description, setDescription] = useState(suggestedDescription);
  const [nameFocused, setNameFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setName(suggestedName);
    }
  }, [isOpen, suggestedName]);

  useEffect(() => {
    if (!isOpen) {
      setDescription(suggestedDescription);
    }
  }, [isOpen, suggestedDescription]);

  const onOpenChange = (newIsOpen: boolean) => {
    if (!newIsOpen) {
      onCancel();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        style={{
          padding: 0,
          background: "var(--bg-card, white)",
          border: "1px solid var(--border, #e2ddd7)",
          borderRadius: 16,
          boxShadow:
            "0 4px 24px oklch(0.4 0.01 280 / 0.12), 0 1px 4px oklch(0.4 0.01 280 / 0.06)",
          fontFamily: "'DM Sans', system-ui, sans-serif",
          maxWidth: 420,
          width: "calc(100vw - 40px)",
          overflow: "hidden",
        }}
        className="sm:max-w-[420px]"
      >
        {/* Header */}
        <div
          style={{
            padding: "13px 44px 13px 16px",
            borderBottom: "1px solid var(--border, #e2ddd7)",
          }}
        >
          <DialogTitle
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: "var(--text, #1a1a1a)",
              letterSpacing: 0,
              lineHeight: 1.3,
            }}
          >
            Save Board
          </DialogTitle>
        </div>

        {/* Body */}
        <div
          style={{
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div>
            <label style={fieldLabel}>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onSave(name, description, name === suggestedName);
                }
              }}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              style={{
                ...inputBase,
                borderColor: nameFocused
                  ? "var(--hkp-accent, #0abcfb)"
                  : "var(--border, #e2ddd7)",
                background: nameFocused ? "white" : "oklch(0.965 0.005 62)",
              }}
            />
          </div>

          <div>
            <label style={fieldLabel}>Description</label>
            <textarea
              value={description || ""}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              onFocus={() => setDescFocused(true)}
              onBlur={() => setDescFocused(false)}
              style={{
                ...inputBase,
                resize: "none",
                lineHeight: "1.5",
                borderColor: descFocused
                  ? "var(--hkp-accent, #0abcfb)"
                  : "var(--border, #e2ddd7)",
                background: descFocused ? "white" : "oklch(0.965 0.005 62)",
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "11px 16px",
            borderTop: "1px solid var(--border, #e2ddd7)",
            display: "flex",
            gap: 6,
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1.5px solid var(--border-mid, #d5d0c8)",
              background: "none",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              color: "var(--text-mid, #666)",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--border, #e2ddd7)";
              (e.currentTarget as HTMLButtonElement).style.color =
                "var(--text, #1a1a1a)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "none";
              (e.currentTarget as HTMLButtonElement).style.color =
                "var(--text-mid, #666)";
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(name, description, name === suggestedName)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1.5px solid var(--hkp-accent, #0abcfb)",
              background: "var(--hkp-accent, #0abcfb)",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              color: "white",
              transition: "filter 0.15s",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.filter =
                "brightness(0.92)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.filter = "")
            }
          >
            Save
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
