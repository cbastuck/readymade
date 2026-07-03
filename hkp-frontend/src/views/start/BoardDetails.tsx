import { useState } from "react";

import { artFor, stateMeta } from "./model";
import { BoardNode } from "./types";

interface Props {
  board: BoardNode;
  /** Resolved description (host-loaded for saved boards). */
  description?: string;
  onOpen?: () => void;
  /** Unfiles the board from the folder it is selected in. */
  onRemoveFromFolder?: () => void;
  /** Deletes the board entirely; asked to confirm with a second click. */
  onDelete?: () => void;
}

/**
 * Finder-style details column for the selected board: artwork, name, state,
 * description, and the actions that apply to it.
 */
export default function BoardDetails({
  board,
  description,
  onOpen,
  onRemoveFromFolder,
  onDelete,
}: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const meta = stateMeta(board.state);

  return (
    <div
      style={{
        flex: "0 0 300px",
        width: 300,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          padding: "13px 14px 11px",
          borderBottom: "1px solid #eceef3",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--st-mut)",
          }}
        >
          Details
        </span>
      </div>

      <div
        className="st-v"
        style={{
          flex: "1 1 auto",
          overflowY: "auto",
          padding: "22px 18px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: 18,
            background: board.art ?? artFor(board.name),
            flex: "0 0 auto",
          }}
        />

        <div style={{ textAlign: "center", minWidth: 0, width: "100%" }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: "-0.01em",
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
              color: "#6b7080",
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
              color: "#6b7080",
              textAlign: "center",
            }}
          >
            {description}
          </p>
        )}

        <div style={{ flex: "1 1 auto" }} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            width: "100%",
            flex: "0 0 auto",
          }}
        >
          {onOpen && (
            <button
              className="st-btn st-btn-primary"
              style={{ justifyContent: "center" }}
              onClick={onOpen}
            >
              Open board
            </button>
          )}
          {onRemoveFromFolder && (
            <button
              className="st-btn st-btn-ghost"
              style={{ justifyContent: "center" }}
              onClick={onRemoveFromFolder}
            >
              Remove from folder
            </button>
          )}
          {onDelete &&
            (confirmingDelete ? (
              <button
                className="st-btn st-btn-ghost"
                style={{
                  justifyContent: "center",
                  color: "#e0355f",
                  borderColor: "#e0355f",
                }}
                onClick={onDelete}
              >
                Really delete “{board.name}”?
              </button>
            ) : (
              <button
                className="st-btn st-btn-ghost"
                style={{ justifyContent: "center", color: "#e0355f" }}
                onClick={() => setConfirmingDelete(true)}
              >
                Delete board
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
