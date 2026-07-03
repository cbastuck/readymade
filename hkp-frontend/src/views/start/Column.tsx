import { useState } from "react";

import Row, { RowVM } from "./Row";

export interface ColumnVM {
  key: string;
  title: string;
  width: string;
  items: RowVM[];
  /** Message shown when the column has no items. */
  emptyHint?: string;
  /** Creates a subfolder here — the header "+" affordance; absent on
   *  read-only (virtual) columns. */
  onNewFolder?: (name: string) => void;
  /** "New board" affordance — creates an empty board filed in this folder. */
  onNewBoard?: (name: string) => void;
}

function NameInput({
  placeholder,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed) {
      onSubmit(trimmed);
    } else {
      onCancel();
    }
  };

  return (
    <input
      className="st-search"
      style={{ width: "calc(100% - 4px)", margin: "4px 2px" }}
      placeholder={placeholder}
      value={name}
      autoFocus
      onChange={(e) => setName(e.target.value)}
      onBlur={submit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          submit();
        }
        if (e.key === "Escape") {
          onCancel();
        }
      }}
    />
  );
}

export default function Column({ col }: { col: ColumnVM }) {
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

  return (
    <div
      style={{
        flex: "0 0 " + col.width,
        width: col.width,
        borderRight: "1px solid #eceef3",
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
          justifyContent: "space-between",
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
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {col.title}
        </span>
        {col.onNewFolder && (
          <button
            className="st-add"
            title="New folder"
            onClick={() => setCreatingFolder(true)}
          >
            +
          </button>
        )}
      </div>

      <div
        className="st-v"
        style={{ flex: "1 1 auto", overflowY: "auto", padding: 6 }}
      >
        {col.items.map((it) => (
          <Row key={it.key} it={it} />
        ))}

        {col.items.length === 0 && !creatingFolder && !creatingBoard && (
          <div
            style={{
              padding: "26px 14px",
              textAlign: "center",
              color: "#b0b5c2",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {col.emptyHint ?? "Empty folder"}
          </div>
        )}

        {creatingFolder && col.onNewFolder && (
          <NameInput
            placeholder="Folder name…"
            onSubmit={(name) => {
              col.onNewFolder!(name);
              setCreatingFolder(false);
            }}
            onCancel={() => setCreatingFolder(false)}
          />
        )}

        {col.onNewBoard &&
          (creatingBoard ? (
            <NameInput
              placeholder="Board name…"
              onSubmit={(name) => {
                col.onNewBoard!(name);
                setCreatingBoard(false);
              }}
              onCancel={() => setCreatingBoard(false)}
            />
          ) : (
            <button className="st-newfolder" onClick={() => setCreatingBoard(true)}>
              <span style={{ fontSize: 15, lineHeight: 0 }}>+</span> New board
            </button>
          ))}
      </div>
    </div>
  );
}
