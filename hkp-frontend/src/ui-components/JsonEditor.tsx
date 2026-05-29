import { ReactNode, useState } from "react";
import {
  Path,
  JsonType,
  JSON_TYPES,
  getAtPath,
  setAtPath,
  deleteAtPath,
  addAtPath,
  defaultForType,
} from "./json-editor/helpers";

// ── Inline icons ───────────────────────────────────────────────

function IconChevronRight({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

function IconPlus({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// ── Deletable row (desktop: ×-button) ──────────────────────────

function DeletableRow({
  onDelete,
  children,
}: {
  onDelete: () => void;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ flex: 1 }}>{children}</div>
      <button
        onClick={onDelete}
        title="Remove"
        style={{
          flexShrink: 0,
          width: 22,
          height: 22,
          border: "none",
          borderRadius: 4,
          background: "transparent",
          color: "hsl(var(--muted-foreground))",
          cursor: "pointer",
          fontSize: 14,
          lineHeight: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ×
      </button>
    </div>
  );
}

// ── Add-field inline form ──────────────────────────────────────

function AddFieldForm({
  isArray,
  onAdd,
  onCancel,
}: {
  isArray: boolean;
  onAdd: (key: string, type: JsonType) => void;
  onCancel: () => void;
}) {
  const [key, setKey] = useState("");
  const [type, setType] = useState<JsonType>("string");

  const handleSubmit = () => {
    if (!isArray && !key.trim()) {
      return;
    }
    onAdd(key.trim(), type);
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    height: 32,
    border: "1px solid var(--hkp-accent)",
    borderRadius: 6,
    padding: "0 8px",
    fontFamily: "inherit",
    fontSize: 13,
    color: "hsl(var(--foreground))",
    background: "hsl(var(--card))",
    outline: "none",
  };

  const selectStyle: React.CSSProperties = {
    height: 32,
    border: "1px solid hsl(var(--border))",
    borderRadius: 6,
    padding: "0 6px",
    fontFamily: "inherit",
    fontSize: 13,
    color: "hsl(var(--foreground))",
    background: "hsl(var(--card))",
    outline: "none",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        padding: "10px 0 4px",
        borderTop: "1.5px dashed var(--hkp-accent)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        marginTop: 4,
      }}
    >
      {!isArray && (
        <input
          autoFocus
          placeholder="Key name"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSubmit();
            }
            if (e.key === "Escape") {
              onCancel();
            }
          }}
          style={inputStyle}
        />
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as JsonType)}
          style={selectStyle}
        >
          {JSON_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          onClick={handleSubmit}
          style={{
            flex: 1,
            height: 32,
            border: "none",
            borderRadius: 6,
            background: "var(--hkp-accent)",
            color: "#fff",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Add
        </button>
        <button
          onClick={onCancel}
          style={{
            height: 32,
            padding: "0 10px",
            border: "1px solid hsl(var(--border))",
            borderRadius: 6,
            background: "transparent",
            color: "hsl(var(--muted-foreground))",
            fontFamily: "inherit",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Value widgets ──────────────────────────────────────────────

function BoolToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        border: "none",
        background: value ? "var(--hkp-accent)" : "hsl(var(--border))",
        cursor: "pointer",
        position: "relative",
        transition: "background 0.15s",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: value ? 19 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.15s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          display: "block",
        }}
      />
    </button>
  );
}

function ValueWidget({
  value,
  onChange,
  onDrillIn,
}: {
  value: any;
  onChange: (v: any) => void;
  onDrillIn: () => void;
}) {
  if (value === null || value === undefined) {
    return (
      <span
        style={{
          fontSize: 12,
          color: "hsl(var(--muted-foreground))",
          fontFamily: "monospace",
        }}
      >
        {String(value)}
      </span>
    );
  }

  if (typeof value === "boolean") {
    return <BoolToggle value={value} onChange={onChange} />;
  }

  if (typeof value === "number") {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: 90,
          height: 28,
          border: "1px solid hsl(var(--border))",
          borderRadius: 6,
          padding: "0 6px",
          fontFamily: "inherit",
          fontSize: 13,
          color: "hsl(var(--foreground))",
          background: "hsl(var(--muted))",
          outline: "none",
          textAlign: "right",
        }}
      />
    );
  }

  if (typeof value === "string") {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          maxWidth: 160,
          height: 28,
          border: "1px solid hsl(var(--border))",
          borderRadius: 6,
          padding: "0 6px",
          fontFamily: "inherit",
          fontSize: 13,
          color: "hsl(var(--foreground))",
          background: "hsl(var(--muted))",
          outline: "none",
        }}
      />
    );
  }

  const isArr = Array.isArray(value);
  const count = isArr ? value.length : Object.keys(value).length;
  return (
    <button
      onClick={onDrillIn}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 8px",
        border: "1px solid hsl(var(--border))",
        borderRadius: 6,
        background: "hsl(var(--muted))",
        cursor: "pointer",
        fontFamily: "monospace",
        fontSize: 12,
        color: "hsl(var(--muted-foreground))",
      }}
    >
      {isArr ? `[ ${count} ]` : `{ ${count} }`}
      <IconChevronRight size={11} />
    </button>
  );
}

// ── Property row ───────────────────────────────────────────────

function PropertyRow({
  label,
  value,
  onChange,
  onDrillIn,
}: {
  label: string;
  value: any;
  onChange: (v: any) => void;
  onDrillIn: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 0",
        borderBottom: "1px solid hsl(var(--border))",
        minHeight: 38,
      }}
    >
      <span
        title={label}
        style={{
          fontSize: 12,
          fontFamily: "monospace",
          color: "hsl(var(--muted-foreground))",
          flexShrink: 0,
          width: "38%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
        <ValueWidget value={value} onChange={onChange} onDrillIn={onDrillIn} />
      </div>
    </div>
  );
}

// ── Root component ─────────────────────────────────────────────

type Props = {
  value: any;
  onChange: (v: any) => void;
  rootLabel?: string;
  showBreadcrumbs?: boolean;
};

export default function JsonEditor({
  value,
  onChange,
  rootLabel = "root",
  showBreadcrumbs = true,
}: Props) {
  const [path, setPath] = useState<Path>([]);
  const [addingField, setAddingField] = useState(false);

  const current = getAtPath(value, path);
  const isArray = Array.isArray(current);
  const isObject = current !== null && typeof current === "object";

  const entries: Array<[string | number, any]> = isArray
    ? current.map((v: any, i: number) => [i, v])
    : isObject
      ? Object.entries(current)
      : [];

  const handleChange = (key: string | number, newVal: any) => {
    onChange(setAtPath(value, [...path, key], newVal));
  };

  const handleDelete = (key: string | number) => {
    onChange(deleteAtPath(value, path, key));
  };

  const handleAdd = (key: string, type: JsonType) => {
    const actualKey: string | number = isArray
      ? (current as any[]).length
      : key;
    onChange(addAtPath(value, path, actualKey, defaultForType(type)));
    setAddingField(false);
  };

  const crumbs = [rootLabel, ...path.map(String)];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      {/* Breadcrumbs */}
      {showBreadcrumbs && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            overflowX: "auto",
            paddingBottom: 8,
            scrollbarWidth: "none",
            gap: 2,
          }}
        >
          {crumbs.map((crumb, i) => {
            const isCurrent = i === crumbs.length - 1;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  flexShrink: 0,
                }}
              >
                {i > 0 && (
                  <span
                    style={{
                      fontSize: 12,
                      color: "hsl(var(--muted-foreground))",
                      userSelect: "none",
                    }}
                  >
                    /
                  </span>
                )}
                <button
                  onClick={() => setPath(path.slice(0, i))}
                  disabled={isCurrent}
                  style={{
                    padding: "2px 6px",
                    border: "none",
                    borderRadius: 5,
                    background: isCurrent
                      ? "hsl(var(--accent))"
                      : "transparent",
                    color: isCurrent
                      ? "var(--hkp-accent)"
                      : "hsl(var(--muted-foreground))",
                    fontSize: 12,
                    fontWeight: isCurrent ? 600 : 400,
                    fontFamily: "monospace",
                    cursor: isCurrent ? "default" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {crumb}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Property list */}
      <div>
        {entries.length === 0 && !addingField && (
          <div
            style={{
              padding: "12px 0",
              fontSize: 13,
              color: "hsl(var(--muted-foreground))",
              textAlign: "center",
              fontStyle: "italic",
            }}
          >
            {isObject ? "Empty — add a field below" : "No properties"}
          </div>
        )}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            maxHeight: "25vh",
          }}
        >
          {entries.map(([key, val]) => (
            <DeletableRow key={String(key)} onDelete={() => handleDelete(key)}>
              <PropertyRow
                label={String(key)}
                value={val}
                onChange={(newVal) => handleChange(key, newVal)}
                onDrillIn={() => setPath([...path, key])}
              />
            </DeletableRow>
          ))}
        </div>
        {isObject &&
          (addingField ? (
            <AddFieldForm
              isArray={isArray}
              onAdd={handleAdd}
              onCancel={() => setAddingField(false)}
            />
          ) : (
            <button
              onClick={() => setAddingField(true)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                padding: "10px 0",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--hkp-accent)",
                fontFamily: "inherit",
              }}
            >
              <IconPlus size={13} />
              Add field
            </button>
          ))}
      </div>
    </div>
  );
}
