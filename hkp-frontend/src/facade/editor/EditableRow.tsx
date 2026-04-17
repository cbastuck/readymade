import { useState, useRef, useEffect } from "react";

type ValueKind = "boolean" | "number" | "string" | "json";

function kindOf(value: unknown): ValueKind {
  if (typeof value === "boolean") { return "boolean"; }
  if (typeof value === "number") { return "number"; }
  if (typeof value === "string") { return "string"; }
  return "json";
}

function valueToString(value: unknown, kind: ValueKind): string {
  if (kind === "json") { return JSON.stringify(value, null, 2); }
  return String(value);
}

export function parseValue(raw: string, kind: ValueKind): unknown {
  if (kind === "number") {
    const n = Number(raw);
    return isNaN(n) ? raw : n;
  }
  if (kind === "json") {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  return raw;
}

export function PropValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>—</span>;
  }
  if (typeof value === "boolean") {
    return <span style={{ color: "hsl(var(--primary))" }}>{value ? "true" : "false"}</span>;
  }
  if (typeof value === "number") {
    return <span style={{ color: "hsl(var(--primary))" }}>{value}</span>;
  }
  if (typeof value === "string") {
    return (
      <span style={{ color: "hsl(var(--foreground))", wordBreak: "break-all" }}>
        {value}
      </span>
    );
  }
  return (
    <pre
      style={{
        margin: 0,
        fontSize: 10,
        fontFamily: "monospace",
        color: "hsl(var(--muted-foreground))",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
      }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "hsl(var(--input))",
  border: "1px solid hsl(var(--ring))",
  borderRadius: 4,
  color: "hsl(var(--foreground))",
  fontFamily: "monospace",
  fontSize: 11,
  padding: "2px 6px",
  outline: "none",
  boxSizing: "border-box",
};

type Props = {
  propKey: string;
  value: unknown;
  onCommit: (key: string, newValue: unknown) => void;
};

export function EditableRow({ propKey, value, onCommit }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const kind = kindOf(value);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [editing]);

  const startEdit = () => {
    if (kind === "boolean") {
      onCommit(propKey, !value);
      return;
    }
    setDraft(valueToString(value, kind));
    setEditing(true);
  };

  const commit = () => {
    onCommit(propKey, parseValue(draft, kind));
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && kind !== "json") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      cancel();
    }
  };

  // Fixed row height shared by both display and single-line edit cells so the
  // layout doesn't shift when toggling between the two. JSON textarea is exempt
  // because multi-line content genuinely needs more vertical space.
  const ROW_HEIGHT = 26;

  const displayCell = (
    <td
      onClick={startEdit}
      style={{
        padding: kind === "json" ? "6px 0" : 0,
        height: kind === "json" ? undefined : ROW_HEIGHT,
        fontSize: 11,
        fontFamily: "monospace",
        verticalAlign: kind === "json" ? "top" : "middle",
        cursor: "text",
      }}
    >
      {kind === "json" ? (
        <PropValue value={value} />
      ) : (
        <div style={{ display: "flex", alignItems: "center", height: ROW_HEIGHT }}>
          <PropValue value={value} />
        </div>
      )}
    </td>
  );

  const editCell = (
    <td style={{ padding: kind === "json" ? "4px 0" : 0, verticalAlign: "middle" }}>
      {kind === "json" ? (
        <textarea
          ref={inputRef as React.Ref<HTMLTextAreaElement>}
          value={draft}
          rows={Math.min(12, draft.split("\n").length + 1)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      ) : (
        <input
          ref={inputRef as React.Ref<HTMLInputElement>}
          type={kind === "number" ? "number" : "text"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          style={{ ...inputStyle, height: ROW_HEIGHT }}
          spellCheck={false}
        />
      )}
    </td>
  );

  return (
    <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
      <td
        style={{
          padding: 0,
          paddingRight: 12,
          height: kind === "json" ? undefined : ROW_HEIGHT,
          fontSize: 11,
          fontFamily: "monospace",
          color: "hsl(var(--muted-foreground))",
          verticalAlign: "middle",
          whiteSpace: "nowrap",
          width: "40%",
        }}
      >
        {propKey}
      </td>
      {editing ? editCell : displayCell}
    </tr>
  );
}
