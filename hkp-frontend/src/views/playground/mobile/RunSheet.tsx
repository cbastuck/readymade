import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import BottomSheet from "./BottomSheet";
import MobileIcon from "./MobileIcon";
import { M } from "./tokens";
import { useBoardContext } from "../../../BoardContext";
import {
  RunPayloadMode,
  SavedPayload,
  isJsonFile,
  isTextFile,
  parseRunJson,
  readFileText,
  useRunPayloads,
} from "../../../core/runPayloads";

/**
 * "Run with…" on a phone: the input written by hand, then sent. The same
 * four ways of writing it as the desktop's dialog (`RunParamsDialog`), and the
 * same payloads kept per board on this device (`core/runPayloads`), so one
 * saved on either is there on the other.
 */

type Props = {
  open: boolean;
  onClose: () => void;
  onRun: (params: unknown) => void;
  /** What receives the payload, as the description names it. */
  target: string;
};

const MODES: { mode: RunPayloadMode; label: string }[] = [
  { mode: "fields", label: "Fields" },
  { mode: "text", label: "Text" },
  { mode: "json", label: "JSON" },
  { mode: "file", label: "File" },
];

type Row = { key: string; value: string };

/** Code, not prose: no smart quotes, dashes, corrections or capitals. */
const codeInputProps = {
  spellCheck: false,
  autoCorrect: "off",
  autoCapitalize: "off",
  autoComplete: "off",
} as const;

// Anything smaller than 16px zooms iOS in on focus, and it stays zoomed.
const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: `1.5px solid ${M.border}`,
  borderRadius: 10,
  background: M.card,
  fontSize: 16,
  color: M.textPrimary,
  outline: "none",
  fontFamily: "inherit",
};

const label: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  color: M.textMuted,
  textTransform: "uppercase",
  marginBottom: 8,
};

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** What the rows say, as the object they build; a row without a name says nothing. */
function templateOf(rows: Row[]): { [key: string]: string } {
  const template: { [key: string]: string } = {};
  for (const { key, value } of rows) {
    if (key.trim()) {
      template[key.trim()] = value;
    }
  }
  return template;
}

const rowsOf = (template: { [key: string]: string }): Row[] =>
  Object.entries(template).map(([key, value]) => ({ key, value: String(value) }));

export default function RunSheet({ open, onClose, onRun, target }: Props) {
  const boardName = useBoardContext()?.boardName;
  const { payloads, save, remove } = useRunPayloads(boardName);

  const [mode, setMode] = useState<RunPayloadMode>("fields");
  // Held apart, so looking at the other way of writing a payload and coming
  // back does not throw away what was written.
  const [rows, setRows] = useState<Row[]>([{ key: "", value: "" }]);
  const [text, setText] = useState("");
  const [json, setJson] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [openInEditor, setOpenInEditor] = useState(true);
  const [savingAs, setSavingAs] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseRunJson(json), [json]);
  const jsonError = json.length > 0 && !parsed.ok ? parsed.error : null;

  // What was being named is let go with the sheet; what was written is kept,
  // since the next run is usually the same one changed a little.
  useEffect(() => {
    if (!open) {
      setSavingAs(null);
    }
  }, [open]);

  const canRun =
    mode === "fields" ||
    (mode === "text" && text.length > 0) ||
    (mode === "json" && parsed.ok) ||
    (mode === "file" && !!file);
  // A file is not kept: it may be any size, and what it is is on disk already.
  const canSave = mode !== "file" && canRun;

  const run = () => {
    if (mode === "fields") {
      onRun(templateOf(rows));
    } else if (mode === "text") {
      onRun(text);
    } else if (mode === "json") {
      if (parsed.ok) {
        onRun(parsed.value);
      }
    } else if (file) {
      onRun(file);
    }
  };

  const loadFile = async (picked: File) => {
    if (!openInEditor || !isTextFile(picked)) {
      setFile(picked);
      setMode("file");
      return;
    }
    const content = await readFileText(picked);
    if (isJsonFile(picked)) {
      setJson(content);
      setMode("json");
    } else {
      setText(content);
      setMode("text");
    }
  };

  const loadSaved = (payload: SavedPayload) => {
    if (payload.mode === "fields") {
      const loaded = rowsOf(payload.template);
      setRows(loaded.length ? loaded : [{ key: "", value: "" }]);
    } else if (payload.mode === "text") {
      setText(payload.text);
    } else {
      setJson(payload.json);
    }
    setMode(payload.mode);
  };

  const saveAs = () => {
    const name = savingAs?.trim();
    if (!name || mode === "file") {
      return;
    }
    save(
      mode === "fields"
        ? { name, mode, template: templateOf(rows) }
        : mode === "text"
          ? { name, mode, text }
          : { name, mode, json },
    );
    setSavingAs(null);
  };

  const setRow = (index: number, change: Partial<Row>) =>
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...change } : row)),
    );

  return (
    <BottomSheet open={open} onClose={onClose} title="Run with…" height="85%">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 13, color: M.textSecondary, lineHeight: 1.4 }}>
          The input {target} is given. Run on its own gives it nothing.
        </div>

        {/* Mode */}
        <div
          role="radiogroup"
          aria-label="How the input is written"
          style={{
            display: "flex",
            background: M.bg,
            borderRadius: 10,
            padding: 3,
            gap: 2,
          }}
        >
          {MODES.map((entry) => {
            const active = entry.mode === mode;
            return (
              <button
                key={entry.mode}
                role="radio"
                aria-checked={active}
                onClick={() => setMode(entry.mode)}
                style={{
                  flex: 1,
                  height: 34,
                  border: "none",
                  borderRadius: 8,
                  background: active ? M.card : "transparent",
                  boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  color: active ? M.textPrimary : M.textSecondary,
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {entry.label}
              </button>
            );
          })}
        </div>

        {/* Editor */}
        {mode === "fields" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((row, i) => (
              <div key={i} style={{ display: "flex", gap: 6 }}>
                <input
                  aria-label={`Name ${i + 1}`}
                  placeholder="name"
                  value={row.key}
                  onChange={(e) => setRow(i, { key: e.target.value })}
                  style={{ ...input, flex: 2, minWidth: 0 }}
                  {...codeInputProps}
                />
                <input
                  aria-label={`Value ${i + 1}`}
                  placeholder="value"
                  value={row.value}
                  onChange={(e) => setRow(i, { value: e.target.value })}
                  style={{ ...input, flex: 3, minWidth: 0 }}
                  {...codeInputProps}
                />
                <button
                  aria-label={`Remove row ${i + 1}`}
                  onClick={() =>
                    setRows((current) =>
                      current.length > 1
                        ? current.filter((_, j) => j !== i)
                        : [{ key: "", value: "" }],
                    )
                  }
                  style={{
                    width: 40,
                    flexShrink: 0,
                    border: `1px solid ${M.border}`,
                    borderRadius: 10,
                    background: M.card,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <MobileIcon name="x" size={14} color={M.textMuted} />
                </button>
              </div>
            ))}
            <button
              onClick={() => setRows((current) => [...current, { key: "", value: "" }])}
              style={{
                alignSelf: "flex-start",
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                border: "none",
                background: "none",
                color: M.tealDark,
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <MobileIcon name="plus" size={14} color={M.tealDark} />
              Add a field
            </button>
          </div>
        ) : mode === "text" ? (
          <textarea
            aria-label="Run input as text"
            placeholder="Any text: a message, a prompt, a document…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ ...input, minHeight: 160, fontFamily: "monospace" }}
            {...codeInputProps}
          />
        ) : mode === "json" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <textarea
              aria-label="Run input as JSON"
              placeholder="[{name: 'a'}, {name: 'b'}]"
              value={json}
              onChange={(e) => setJson(e.target.value)}
              style={{
                ...input,
                minHeight: 160,
                fontFamily: "monospace",
                borderColor: jsonError ? M.danger : M.border,
              }}
              {...codeInputProps}
            />
            {jsonError && (
              <div style={{ fontSize: 12, color: M.danger }}>{jsonError}</div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                minHeight: 120,
                border: `1.5px dashed ${M.borderStrong}`,
                borderRadius: 12,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: 16,
                textAlign: "center",
              }}
            >
              {file ? (
                <>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: M.textPrimary,
                      wordBreak: "break-all",
                    }}
                  >
                    {file.name}
                  </span>
                  <span style={{ fontSize: 12, color: M.textMuted }}>
                    {formatSize(file.size)}
                    {file.type ? ` · ${file.type}` : ""}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 13, color: M.textMuted }}>
                  No file chosen
                </span>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  height: 38,
                  padding: "0 14px",
                  border: `1.5px solid ${M.teal}`,
                  borderRadius: 10,
                  background: M.tealLight,
                  color: M.tealDark,
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {file ? "Choose another" : "Choose a file"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                data-testid="run-sheet-file-input"
                onChange={(e) => {
                  const picked = e.target.files?.[0];
                  if (picked) {
                    void loadFile(picked);
                  }
                  // So picking the same file again is still a change.
                  e.target.value = "";
                }}
              />
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 14,
                color: M.textSecondary,
              }}
            >
              <input
                type="checkbox"
                checked={openInEditor}
                onChange={(e) => setOpenInEditor(e.target.checked)}
                style={{ width: 20, height: 20, accentColor: M.teal }}
              />
              Open JSON and text files in the editor
            </label>
          </div>
        )}

        {/* Saved payloads */}
        {payloads.length > 0 && (
          <div>
            <div style={label}>Saved for this board</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {payloads.map((payload) => (
                <div
                  key={payload.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    border: `1px solid ${M.border}`,
                    borderRadius: 10,
                    background: M.card,
                  }}
                >
                  <button
                    onClick={() => loadSaved(payload)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "11px 12px",
                      border: "none",
                      background: "none",
                      textAlign: "left",
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        fontSize: 14,
                        color: M.textPrimary,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {payload.name}
                    </span>
                    <span style={{ fontSize: 12, color: M.textMuted }}>
                      {MODES.find((m) => m.mode === payload.mode)?.label}
                    </span>
                  </button>
                  <button
                    aria-label={`Forget ${payload.name}`}
                    onClick={() => remove(payload.name)}
                    style={{
                      width: 44,
                      height: 44,
                      border: "none",
                      background: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <MobileIcon name="trash" size={15} color={M.textMuted} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Save + Run */}
        {savingAs === null ? (
          <div style={{ display: "flex", gap: 10 }}>
            <button
              disabled={!canSave}
              onClick={() => setSavingAs("")}
              style={{
                flex: 1,
                height: 46,
                border: `1.5px solid ${M.border}`,
                borderRadius: 12,
                background: M.card,
                color: M.textSecondary,
                fontFamily: "inherit",
                fontSize: 15,
                fontWeight: 600,
                cursor: canSave ? "pointer" : "default",
                opacity: canSave ? 1 : 0.45,
              }}
            >
              Save
            </button>
            <button
              disabled={!canRun}
              onClick={run}
              style={{
                flex: 2,
                height: 46,
                border: "none",
                borderRadius: 12,
                background: M.teal,
                color: "#fff",
                fontFamily: "inherit",
                fontSize: 15,
                fontWeight: 600,
                cursor: canRun ? "pointer" : "default",
                opacity: canRun ? 1 : 0.45,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <MobileIcon name="play" size={15} color="#fff" />
              Run
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              autoFocus
              aria-label="Payload name"
              placeholder="Name it — “empty list”"
              value={savingAs}
              onChange={(e) => setSavingAs(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  saveAs();
                }
              }}
              style={{ ...input, flex: 1 }}
              spellCheck={false}
            />
            <button
              disabled={!savingAs.trim()}
              onClick={saveAs}
              style={{
                height: 44,
                padding: "0 16px",
                border: "none",
                borderRadius: 10,
                background: M.teal,
                color: "#fff",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 600,
                opacity: savingAs.trim() ? 1 : 0.45,
                cursor: "pointer",
              }}
            >
              Save
            </button>
            <button
              aria-label="Cancel saving"
              onClick={() => setSavingAs(null)}
              style={{
                width: 44,
                height: 44,
                border: `1px solid ${M.border}`,
                borderRadius: 10,
                background: M.card,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <MobileIcon name="x" size={14} color={M.textSecondary} />
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
