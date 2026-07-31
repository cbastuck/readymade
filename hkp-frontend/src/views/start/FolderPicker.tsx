import { useState } from "react";

import { FolderOption, folderKey } from "./model";

/**
 * Modal folder chooser for a board: check the folders it should be filed in.
 * Folders act as hierarchical tags, so any number of them can be picked;
 * with none picked the board is listed loose under My Boards.
 */
export default function FolderPicker({
  boardName,
  folders,
  assigned,
  onToggle,
  onCreateFolder,
  onClose,
}: {
  boardName: string;
  /** All user folders, depth-first. */
  folders: FolderOption[];
  /** Keys (folderKey) of the folders the board is currently filed in. */
  assigned: Set<string>;
  onToggle: (path: string[], filed: boolean) => void;
  /** Creates a folder inside `parentPath` and files the board into it. */
  onCreateFolder: (parentPath: string[], name: string) => void;
  onClose: () => void;
}) {
  // Folder the inline name input belongs to; [] is a new top-level folder.
  const [creatingIn, setCreatingIn] = useState<string[] | null>(null);
  const [newName, setNewName] = useState("");

  const startCreating = (parentPath: string[]) => {
    setCreatingIn(parentPath);
    setNewName("");
  };

  const submitNew = () => {
    const name = newName.trim();
    if (name && creatingIn) {
      onCreateFolder(creatingIn, name);
    }
    setCreatingIn(null);
    setNewName("");
  };

  const nameInput = (
    <input
      className="st-search"
      style={{ width: "100%", margin: "4px 0" }}
      placeholder="Folder name…"
      value={newName}
      autoFocus
      onChange={(e) => setNewName(e.target.value)}
      onBlur={submitNew}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          submitNew();
        }
        if (e.key === "Escape") {
          setCreatingIn(null);
        }
      }}
    />
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,22,28,0.32)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 40,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 380,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "min(70vh, 560px)",
          display: "flex",
          flexDirection: "column",
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 18px 48px rgba(20,22,28,0.28)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: "0 0 auto",
            padding: "14px 16px 12px",
            borderBottom: "1px solid #eceef3",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700 }}>Folders</div>
          <div style={{ marginTop: 3, fontSize: 12.5, color: "#6b7080" }}>
            Where “{boardName}” is filed
          </div>
        </div>

        <div
          className="st-v"
          style={{ flex: "1 1 auto", overflowY: "auto", padding: 6 }}
        >
          {folders.length === 0 && creatingIn === null && (
            <div
              style={{
                padding: "22px 14px",
                textAlign: "center",
                color: "#b0b5c2",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              No folders yet
            </div>
          )}

          {folders.map((folder) => {
            const key = folderKey(folder.path);
            const filed = assigned.has(key);
            return (
              <div key={key}>
                <div
                  className="st-row"
                  style={{ paddingLeft: 8 + folder.depth * 16 }}
                  onClick={() => onToggle(folder.path, !filed)}
                >
                  {/* Drawn rather than a native checkbox: hosts differ in
                      their CSS reset, this renders the same everywhere. */}
                  <span
                    style={{
                      flex: "0 0 auto",
                      width: 16,
                      height: 16,
                      borderRadius: 5,
                      border: filed ? "none" : "1px solid #cfd3dd",
                      background: filed ? "var(--st-accent)" : "#fff",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 700,
                      lineHeight: "16px",
                      textAlign: "center",
                    }}
                  >
                    {filed ? "✓" : ""}
                  </span>
                  <span
                    style={{
                      flex: "1 1 auto",
                      minWidth: 0,
                      fontSize: 13,
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {folder.name}
                  </span>
                  <button
                    className="st-add"
                    title="New folder inside"
                    onClick={(e) => {
                      e.stopPropagation();
                      startCreating(folder.path);
                    }}
                  >
                    +
                  </button>
                </div>
                {creatingIn !== null &&
                  folderKey(creatingIn) === key && (
                    <div style={{ paddingLeft: 24 + folder.depth * 16 }}>
                      {nameInput}
                    </div>
                  )}
              </div>
            );
          })}

          {creatingIn !== null && creatingIn.length === 0 ? (
            nameInput
          ) : (
            <button className="st-newfolder" onClick={() => startCreating([])}>
              <span style={{ fontSize: 15, lineHeight: 0 }}>+</span> New folder
            </button>
          )}
        </div>

        <div
          style={{
            flex: "0 0 auto",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 16px 14px",
            borderTop: "1px solid #eceef3",
          }}
        >
          <span style={{ flex: "1 1 auto", fontSize: 12, color: "#9a9fae" }}>
            {assigned.size === 0
              ? "Listed directly under My Boards"
              : `In ${assigned.size} ${assigned.size === 1 ? "folder" : "folders"}`}
          </span>
          <button
            className="st-btn st-btn-primary"
            style={{ justifyContent: "center" }}
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
