import { ReactNode, useEffect, useRef, useState } from "react";
import { M } from "./tokens";
import MobileIcon from "./MobileIcon";

// ── Types ──────────────────────────────────────────────────────

type Path = Array<string | number>;
type JsonType = "string" | "number" | "boolean" | "null" | "array" | "object";

const JSON_TYPES: JsonType[] = ["string", "number", "boolean", "null", "array", "object"];

// ── Immutable path helpers ─────────────────────────────────────

function getAtPath(obj: any, path: Path): any {
  return path.reduce((acc, key) => (acc != null ? acc[key] : undefined), obj);
}

function setAtPath(obj: any, path: Path, value: any): any {
  if (path.length === 0) { return value; }
  const [head, ...tail] = path;
  if (Array.isArray(obj)) {
    const copy = [...obj];
    copy[head as number] = setAtPath(copy[head as number], tail, value);
    return copy;
  }
  return { ...obj, [head as string]: setAtPath(obj[head as string], tail, value) };
}

function deleteAtPath(obj: any, path: Path, key: string | number): any {
  const current = getAtPath(obj, path);
  if (Array.isArray(current)) {
    const copy = [...current];
    copy.splice(key as number, 1);
    return setAtPath(obj, path, copy);
  }
  const copy = { ...current };
  delete copy[key as string];
  return setAtPath(obj, path, copy);
}

function addAtPath(obj: any, path: Path, key: string | number, value: any): any {
  const current = getAtPath(obj, path);
  if (Array.isArray(current)) {
    return setAtPath(obj, path, [...current, value]);
  }
  return setAtPath(obj, path, { ...current, [key as string]: value });
}

function defaultForType(type: JsonType): any {
  if (type === "string") { return ""; }
  if (type === "number") { return 0; }
  if (type === "boolean") { return false; }
  if (type === "null") { return null; }
  if (type === "array") { return []; }
  return {};
}

// ── Swipe-to-delete row ────────────────────────────────────────

const DELETE_W = 68;

function SwipeableRow({ onDelete, children }: { onDelete: () => void; children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<{
    x: number;
    y: number;
    startOffset: number;
    dir: "h" | "v" | null;
  } | null>(null);
  const offsetRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    const content = contentRef.current;
    if (!el || !content) { return; }

    const snap = (target: number) => {
      offsetRef.current = target;
      content.style.transition = "transform 0.2s ease";
      content.style.transform = `translateX(${target}px)`;
    };

    const onStart = (e: TouchEvent) => {
      gestureRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        startOffset: offsetRef.current,
        dir: null,
      };
      content.style.transition = "none";
    };

    const onMove = (e: TouchEvent) => {
      const g = gestureRef.current;
      if (!g) { return; }
      const dx = e.touches[0].clientX - g.x;
      const dy = e.touches[0].clientY - g.y;
      if (g.dir === null) {
        if (Math.abs(dx) > 6) { g.dir = "h"; }
        else if (Math.abs(dy) > 6) { g.dir = "v"; }
      }
      if (g.dir !== "h") { return; }
      e.preventDefault();
      const next = Math.max(-DELETE_W, Math.min(0, g.startOffset + dx));
      offsetRef.current = next;
      content.style.transform = `translateX(${next}px)`;
    };

    const onEnd = () => {
      const g = gestureRef.current;
      if (g?.dir === "h") {
        snap(offsetRef.current < -DELETE_W / 2 ? -DELETE_W : 0);
      }
      gestureRef.current = null;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, []);

  const handleDelete = () => {
    const content = contentRef.current;
    if (content) {
      content.style.transition = "transform 0.15s ease";
      content.style.transform = "translateX(0)";
    }
    offsetRef.current = 0;
    onDelete();
  };

  return (
    <div ref={containerRef} style={{ position: "relative", overflow: "hidden" }}>
      {/* Delete zone revealed on swipe */}
      <div
        onClick={handleDelete}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: DELETE_W,
          background: M.danger,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <MobileIcon name="trash" size={18} color="#fff" />
      </div>

      {/* Sliding content */}
      <div ref={contentRef} style={{ position: "relative", background: M.card }}>
        {children}
      </div>
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
    if (!isArray && !key.trim()) { return; }
    onAdd(key.trim(), type);
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    height: 36,
    border: `1px solid ${M.teal}`,
    borderRadius: 8,
    padding: "0 10px",
    fontFamily: "inherit",
    fontSize: 13,
    color: M.textPrimary,
    background: M.card,
    outline: "none",
  };

  const selectStyle: React.CSSProperties = {
    height: 36,
    border: `1px solid ${M.border}`,
    borderRadius: 8,
    padding: "0 8px",
    fontFamily: "inherit",
    fontSize: 13,
    color: M.textPrimary,
    background: M.card,
    outline: "none",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        padding: "12px 0 4px",
        borderTop: `1.5px dashed ${M.teal}`,
        display: "flex",
        flexDirection: "column",
        gap: 8,
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
            if (e.key === "Enter") { handleSubmit(); }
            if (e.key === "Escape") { onCancel(); }
          }}
          style={inputStyle}
        />
      )}
      <div style={{ display: "flex", gap: 8 }}>
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
            height: 36,
            border: "none",
            borderRadius: 8,
            background: M.teal,
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
            height: 36,
            padding: "0 12px",
            border: `1px solid ${M.border}`,
            borderRadius: 8,
            background: M.card,
            color: M.textSecondary,
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

function BoolToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        border: "none",
        background: value ? M.teal : M.borderStrong,
        cursor: "pointer",
        position: "relative",
        transition: "background 0.15s",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: value ? 21 : 3,
          width: 20,
          height: 20,
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
      <span style={{ fontSize: 12, color: M.textMuted, fontFamily: "monospace" }}>
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
          width: 100,
          height: 32,
          border: `1px solid ${M.border}`,
          borderRadius: 6,
          padding: "0 8px",
          fontFamily: "inherit",
          fontSize: 13,
          color: M.textPrimary,
          background: "#f8f5f2",
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
          maxWidth: 180,
          height: 32,
          border: `1px solid ${M.border}`,
          borderRadius: 6,
          padding: "0 8px",
          fontFamily: "inherit",
          fontSize: 13,
          color: M.textPrimary,
          background: "#f8f5f2",
          outline: "none",
        }}
      />
    );
  }

  // object or array → drill-in button
  const isArr = Array.isArray(value);
  const count = isArr ? value.length : Object.keys(value).length;
  return (
    <button
      onClick={onDrillIn}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        border: `1px solid ${M.border}`,
        borderRadius: 8,
        background: "#f8f5f2",
        cursor: "pointer",
        fontFamily: "monospace",
        fontSize: 12,
        color: M.textSecondary,
      }}
    >
      {isArr ? `[ ${count} ]` : `{ ${count} }`}
      <MobileIcon name="chevronRight" size={12} color={M.textMuted} />
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
        gap: 10,
        padding: "8px 0",
        borderBottom: `1px solid ${M.border}`,
        minHeight: 44,
      }}
    >
      <span
        title={label}
        style={{
          fontSize: 12,
          fontFamily: "monospace",
          color: M.textSecondary,
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
};

export default function JsonEditor({ value, onChange, rootLabel = "root" }: Props) {
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
    const actualKey: string | number = isArray ? (current as any[]).length : key;
    onChange(addAtPath(value, path, actualKey, defaultForType(type)));
    setAddingField(false);
  };

  // crumbs[i] navigates to path.slice(0, i)
  const crumbs = [rootLabel, ...path.map(String)];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Breadcrumbs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          overflowX: "auto",
          paddingBottom: 10,
          scrollbarWidth: "none",
          gap: 2,
        }}
      >
        {crumbs.map((crumb, i) => {
          const isCurrent = i === crumbs.length - 1;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
              {i > 0 && (
                <span style={{ fontSize: 12, color: M.textMuted, userSelect: "none" }}>/</span>
              )}
              <button
                onClick={() => setPath(path.slice(0, i))}
                disabled={isCurrent}
                style={{
                  padding: "3px 7px",
                  border: "none",
                  borderRadius: 6,
                  background: isCurrent ? M.tealLight : "transparent",
                  color: isCurrent ? M.tealDark : M.textSecondary,
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

      {/* Property list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {entries.length === 0 && !addingField && (
          <div
            style={{
              padding: "16px 0",
              fontSize: 13,
              color: M.textMuted,
              textAlign: "center",
              fontStyle: "italic",
            }}
          >
            {isObject ? "Empty — add a field below" : "No properties"}
          </div>
        )}

        {entries.map(([key, val]) => (
          <SwipeableRow key={String(key)} onDelete={() => handleDelete(key)}>
            <PropertyRow
              label={String(key)}
              value={val}
              onChange={(newVal) => handleChange(key, newVal)}
              onDrillIn={() => setPath([...path, key])}
            />
          </SwipeableRow>
        ))}

        {/* Add field */}
        {isObject && (
          addingField ? (
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
                gap: 6,
                padding: "14px 0",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
                color: M.teal,
                fontFamily: "inherit",
              }}
            >
              <MobileIcon name="plus" size={14} color={M.teal} />
              Add field
            </button>
          )
        )}
      </div>
    </div>
  );
}
