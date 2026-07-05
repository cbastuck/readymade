import { useState, type ReactNode } from "react";

import { M } from "../../playground/mobile/tokens";
import { artFor, stateMeta } from "../model";
import { BoardHistoryItem, BoardNode } from "../types";

function reasonOf(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Please try again.";
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ActionButton({
  label,
  tone = "default",
  disabled,
  onClick,
}: {
  label: string;
  tone?: "default" | "primary" | "danger";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        boxSizing: "border-box",
        padding: "13px 14px",
        borderRadius: 12,
        border: tone === "primary" ? "none" : `1px solid ${M.border}`,
        background: tone === "primary" ? M.teal : M.card,
        color:
          tone === "primary" ? "#fff" : tone === "danger" ? M.danger : M.textPrimary,
        fontSize: 15,
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: M.textMuted,
        padding: "0 4px",
      }}
    >
      {children}
    </div>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 12, color: M.danger, textAlign: "center" }}>
      {children}
    </div>
  );
}

function HistorySection({
  loadHistory,
}: {
  loadHistory: () => Promise<BoardHistoryItem[]>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<BoardHistoryItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && items === null) {
      loadHistory()
        .then(setItems)
        .catch(() => setFailed(true));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <ActionButton
        label={
          (expanded ? "Close History" : "Open History") +
          (items !== null ? ` (${items.length})` : "")
        }
        onClick={toggle}
      />
      {expanded && (
        <div
          style={{
            background: M.card,
            border: `1px solid ${M.border}`,
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {failed && (
            <div style={{ padding: 14, fontSize: 12, color: M.danger }}>
              Could not load the history.
            </div>
          )}
          {!failed && items === null && (
            <div style={{ padding: 14, fontSize: 12, color: M.textMuted }}>
              Loading…
            </div>
          )}
          {items !== null && items.length === 0 && (
            <div style={{ padding: 14, fontSize: 12, color: M.textMuted }}>
              No saved versions yet.
            </div>
          )}
          {items?.map((item, index) => (
            <button
              key={`${item.timestamp}-${index}`}
              onClick={item.open}
              style={{
                width: "100%",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 14px",
                border: "none",
                borderTop: index > 0 ? `1px solid ${M.border}` : "none",
                background: "none",
                fontFamily: "inherit",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                style={{ flex: 1, fontSize: 13, fontWeight: 600, color: M.textPrimary }}
              >
                {formatTimestamp(item.timestamp)}
              </span>
              {item.label && (
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: M.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {item.label}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Board details as a pushed page: artwork, name, state, description, and the
 * actions that apply — the mobile counterpart of the desktop details column
 * (without the artwork editor).
 */
export default function MobileBoardDetails({
  board,
  description,
  onOpen,
  onUploadToCloud,
  onRemoveFromFolder,
  onDelete,
  onRevokeShare,
  onLeaveShare,
  loadHistory,
}: {
  board: BoardNode;
  description?: string;
  onOpen?: () => void;
  onUploadToCloud?: () => Promise<void>;
  onRemoveFromFolder?: () => void;
  onDelete?: () => void;
  onRevokeShare?: (email: string) => Promise<void>;
  onLeaveShare?: () => Promise<void>;
  loadHistory?: () => Promise<BoardHistoryItem[]>;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [shareBusy, setShareBusy] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [cloudState, setCloudState] = useState<"idle" | "busy" | "done" | "error">(
    "idle",
  );
  const [cloudError, setCloudError] = useState<string | null>(null);
  const meta = stateMeta(board.state);

  const revokeShare = async (email: string) => {
    if (!onRevokeShare || shareBusy) {
      return;
    }
    setShareBusy(email);
    setShareError(null);
    try {
      await onRevokeShare(email);
    } catch (err) {
      setShareError(reasonOf(err));
    } finally {
      setShareBusy(null);
    }
  };

  const leaveShare = async () => {
    if (!onLeaveShare || shareBusy) {
      return;
    }
    setShareBusy("__leave__");
    setShareError(null);
    try {
      await onLeaveShare();
    } catch (err) {
      setShareError(reasonOf(err));
    } finally {
      setShareBusy(null);
      setConfirmingLeave(false);
    }
  };

  const uploadToCloud = async () => {
    if (!onUploadToCloud || cloudState === "busy") {
      return;
    }
    setCloudState("busy");
    setCloudError(null);
    try {
      await onUploadToCloud();
      setCloudState("done");
    } catch (err) {
      setCloudError(reasonOf(err));
      setCloudState("error");
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "20px 16px calc(24px + env(safe-area-inset-bottom))",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 92,
            height: 92,
            borderRadius: 20,
            background: board.art ?? artFor(board.name),
          }}
        />
        <div style={{ textAlign: "center", minWidth: 0, width: "100%" }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 18,
              color: M.textPrimary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {board.name}
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 5,
              fontSize: 12,
              fontWeight: 600,
              color: M.textSecondary,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: meta.dot,
              }}
            />
            {board.by ? `${meta.label} · ${board.by}` : meta.label}
          </div>
        </div>
        {description && (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.5,
              color: M.textSecondary,
              textAlign: "center",
            }}
          >
            {description}
          </p>
        )}
      </div>

      {board.sharedWith && board.sharedWith.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SectionLabel>Shared with</SectionLabel>
          <div
            style={{
              background: M.card,
              border: `1px solid ${M.border}`,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {board.sharedWith.map((email, index) => (
              <div
                key={email}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 14px",
                  borderTop: index > 0 ? `1px solid ${M.border}` : "none",
                }}
              >
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 13,
                    color: M.textPrimary,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {email}
                </span>
                {onRevokeShare && (
                  <button
                    disabled={shareBusy !== null}
                    onClick={() => void revokeShare(email)}
                    style={{
                      border: "none",
                      background: "none",
                      fontSize: 12,
                      fontWeight: 600,
                      color: M.danger,
                      fontFamily: "inherit",
                      cursor: shareBusy !== null ? "default" : "pointer",
                      opacity: shareBusy !== null ? 0.5 : 1,
                      padding: "4px 6px",
                    }}
                  >
                    {shareBusy === email ? "Revoking…" : "Revoke"}
                  </button>
                )}
              </div>
            ))}
          </div>
          {shareError && <ErrorText>{shareError}</ErrorText>}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {onOpen && <ActionButton label="Open board" tone="primary" onClick={onOpen} />}
        {onUploadToCloud && (
          <>
            <ActionButton
              label={
                cloudState === "busy"
                  ? "Uploading…"
                  : cloudState === "done"
                    ? "Uploaded to cloud ✓"
                    : "Upload to cloud"
              }
              disabled={cloudState === "busy"}
              onClick={() => void uploadToCloud()}
            />
            {cloudState === "error" && cloudError && (
              <ErrorText>Upload failed — {cloudError}</ErrorText>
            )}
          </>
        )}
        {onRemoveFromFolder && (
          <ActionButton label="Remove from folder" onClick={onRemoveFromFolder} />
        )}
        {onLeaveShare && (
          <>
            <ActionButton
              label={
                confirmingLeave
                  ? shareBusy === "__leave__"
                    ? "Removing…"
                    : `Really leave “${board.name}”?`
                  : "Remove me from this board"
              }
              tone="danger"
              disabled={shareBusy !== null}
              onClick={() => {
                if (confirmingLeave) {
                  void leaveShare();
                } else {
                  setConfirmingLeave(true);
                }
              }}
            />
            {shareError && !board.sharedWith?.length && (
              <ErrorText>{shareError}</ErrorText>
            )}
          </>
        )}
        {onDelete && (
          <ActionButton
            label={
              confirmingDelete ? `Really delete “${board.name}”?` : "Delete board"
            }
            tone="danger"
            onClick={() => {
              if (confirmingDelete) {
                onDelete();
              } else {
                setConfirmingDelete(true);
              }
            }}
          />
        )}
      </div>

      {loadHistory && <HistorySection loadHistory={loadHistory} />}
    </div>
  );
}
