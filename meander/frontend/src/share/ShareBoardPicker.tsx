import { SharePayload } from "./shareInbox";

/**
 * Bottom sheet shown when a share arrives from the iOS share sheet. It previews
 * the shared content and lets the user pick which board should consume it. The
 * chosen board opens and runs once with the share as its pipeline-head input.
 *
 * Styling is fully inline (neutral, theme-agnostic) to stay clear of the app's
 * global CSS load order.
 */
export default function ShareBoardPicker({
  share,
  boards,
  onPick,
  onCancel,
}: {
  share: SharePayload;
  boards: string[];
  onPick: (boardName: string) => void;
  onCancel: () => void;
}) {
  const preview =
    share.file?.name ?? share.url ?? share.text ?? "Shared content";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose a board for the shared content"
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#ffffff",
          color: "#1a1a1a",
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          paddingTop: 14,
          paddingBottom: "max(20px, env(safe-area-inset-bottom))",
          maxHeight: "72vh",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'DM Sans', system-ui, sans-serif",
          boxShadow: "0 -8px 30px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            width: 38,
            height: 4,
            borderRadius: 2,
            background: "rgba(0,0,0,0.18)",
            alignSelf: "center",
            marginBottom: 14,
          }}
        />

        <div style={{ padding: "0 20px 12px" }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Send to a board</div>
          <div
            style={{
              fontSize: 13,
              color: "rgba(0,0,0,0.55)",
              marginTop: 4,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={preview}
          >
            {preview}
          </div>
        </div>

        <div
          style={{
            overflowY: "auto",
            borderTop: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          {boards.length === 0 ? (
            <div
              style={{
                padding: "28px 20px",
                textAlign: "center",
                fontSize: 15,
                color: "rgba(0,0,0,0.5)",
              }}
            >
              You don't have any saved boards yet. Create one first, then share
              again.
            </div>
          ) : (
            boards.map((name) => (
              <button
                key={name}
                onClick={() => onPick(name)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "15px 20px",
                  border: "none",
                  borderBottom: "1px solid rgba(0,0,0,0.06)",
                  background: "transparent",
                  fontSize: 16,
                  color: "#1a1a1a",
                  cursor: "pointer",
                }}
              >
                {name}
              </button>
            ))
          )}
        </div>

        <button
          onClick={onCancel}
          style={{
            margin: "14px 20px 0",
            padding: "14px",
            border: "none",
            borderRadius: 12,
            background: "rgba(0,0,0,0.06)",
            fontSize: 16,
            fontWeight: 600,
            color: "#1a1a1a",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
