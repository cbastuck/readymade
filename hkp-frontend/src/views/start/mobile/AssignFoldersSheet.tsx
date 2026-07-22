import { useState } from "react";

import BottomSheet from "../../playground/mobile/BottomSheet";
import { M } from "../../playground/mobile/tokens";
import { FolderOption, folderKey } from "../model";

/**
 * Bottom sheet choosing the folders a board is filed in. Folders act as
 * hierarchical tags, so any number of them can be picked; with none picked the
 * board is listed loose under My Boards.
 */
export default function AssignFoldersSheet({
  open,
  boardName,
  folders,
  assigned,
  onToggle,
  onCreateFolder,
  onClose,
}: {
  open: boolean;
  boardName: string;
  /** All user folders, depth-first. */
  folders: FolderOption[];
  /** Keys (folderKey) of the folders the board is currently filed in. */
  assigned: Set<string>;
  onToggle: (path: string[], filed: boolean) => void;
  /** Creates a top-level folder and files the board into it. */
  onCreateFolder: (name: string) => void;
  onClose: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const submitNew = () => {
    const name = newName.trim();
    if (name) {
      onCreateFolder(name);
    }
    setCreating(false);
    setNewName("");
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`Folders — ${boardName}`}
      height="auto"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          paddingBottom: 8,
        }}
      >
        {folders.length === 0 && (
          <div style={{ fontSize: 13, color: M.textMuted, padding: "4px 2px" }}>
            No folders yet — create one below.
          </div>
        )}

        {folders.length > 0 && (
          <div
            style={{
              background: M.bg,
              border: `1px solid ${M.border}`,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {folders.map((folder, index) => {
              const filed = assigned.has(folderKey(folder.path));
              return (
                <button
                  key={folderKey(folder.path)}
                  onClick={() => onToggle(folder.path, !filed)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    paddingLeft: 14 + folder.depth * 16,
                    border: "none",
                    borderTop: index > 0 ? `1px solid ${M.border}` : "none",
                    background: "none",
                    fontFamily: "inherit",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      flexShrink: 0,
                      fontSize: 15,
                      fontWeight: 700,
                      color: filed ? M.teal : M.border,
                    }}
                  >
                    {filed ? "✓" : "○"}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 15,
                      fontWeight: 600,
                      color: M.textPrimary,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {folder.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {creating ? (
          <input
            autoFocus
            value={newName}
            placeholder="Folder name…"
            onChange={(e) => setNewName(e.target.value)}
            onBlur={submitNew}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                submitNew();
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
        ) : (
          <button
            onClick={() => setCreating(true)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "13px 14px",
              borderRadius: 12,
              border: `1px solid ${M.border}`,
              background: M.card,
              color: M.textPrimary,
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            + New folder
          </button>
        )}

        <div style={{ fontSize: 12, color: M.textMuted, textAlign: "center" }}>
          {assigned.size === 0
            ? "Listed directly under My Boards"
            : `In ${assigned.size} ${assigned.size === 1 ? "folder" : "folders"}`}
        </div>
      </div>
    </BottomSheet>
  );
}
