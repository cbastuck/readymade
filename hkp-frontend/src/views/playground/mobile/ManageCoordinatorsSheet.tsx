import { type CSSProperties, useState } from "react";

import BottomSheet from "./BottomSheet";
import MobileIcon from "./MobileIcon";
import { M } from "./tokens";
import { useMobileConnections } from "./MobileConnections";

type Props = {
  open: boolean;
  onClose: () => void;
};

const inputStyle: CSSProperties = {
  width: "100%",
  border: `1px solid ${M.border}`,
  borderRadius: 10,
  padding: "11px 12px",
  fontSize: 16, // >=16 prevents iOS auto-zoom on focus
  fontFamily: "inherit",
  color: M.textPrimary,
  background: M.bg,
  outline: "none",
  boxSizing: "border-box",
};

// Mirror NewCoordinatorPanel: a coordinator URL always ends in /coordinator.
function normalizeCoordinatorUrl(raw: string): string {
  const base = raw.trim().replace(/\/$/, "");
  return base.endsWith("/coordinator") ? base : `${base}/coordinator`;
}

export default function ManageCoordinatorsSheet({ open, onClose }: Props) {
  const { coordinators, addCoordinator, removeCoordinator } =
    useMobileConnections();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("http://127.0.0.1:8080/coordinator");

  const canAdd = name.trim().length > 0 && url.trim().length > 0;

  const onAdd = () => {
    if (!canAdd) {
      return;
    }
    addCoordinator({ name: name.trim(), url: normalizeCoordinatorUrl(url) });
    setName("");
    setUrl("http://127.0.0.1:8080/coordinator");
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Manage Coordinators"
      height="80%"
    >
      {coordinators.length === 0 ? (
        <div
          style={{
            fontSize: 13,
            color: M.textMuted,
            fontStyle: "italic",
            padding: "4px 4px 16px",
            lineHeight: 1.5,
          }}
        >
          No coordinators yet — add one below to host cloud boards.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
          {coordinators.map((c, i) => (
            <div
              key={c.url ?? i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                border: `1px solid ${M.border}`,
                borderRadius: 12,
                background: M.card,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  background: M.tealLight,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <MobileIcon name="cloud" size={18} color={M.tealDark} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: M.textPrimary,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: M.textMuted,
                    marginTop: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.url}
                </div>
              </div>
              <button
                onClick={() => removeCoordinator(c)}
                aria-label={`Remove ${c.name}`}
                style={{
                  width: 34,
                  height: 34,
                  border: "none",
                  background: "rgba(239,68,68,0.1)",
                  borderRadius: 9,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <MobileIcon name="trash" size={15} color={M.danger} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Add a coordinator ── */}
      <div
        style={{
          marginTop: 12,
          padding: 14,
          border: `1px solid ${M.border}`,
          borderRadius: 14,
          background: M.bg,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: M.textMuted,
          }}
        >
          Add a coordinator
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          style={inputStyle}
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Base URL"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          style={inputStyle}
        />
        <button
          onClick={onAdd}
          disabled={!canAdd}
          style={{
            height: 46,
            border: "none",
            borderRadius: 12,
            background: canAdd ? M.teal : M.borderStrong,
            color: "#fff",
            fontFamily: "inherit",
            fontSize: 15,
            fontWeight: 600,
            cursor: canAdd ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <MobileIcon name="plus" size={16} color="#fff" strokeWidth={2.2} />
          Add coordinator
        </button>
      </div>
    </BottomSheet>
  );
}
