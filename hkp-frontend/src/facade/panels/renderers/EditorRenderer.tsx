import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { EditorMountHandler } from "hkp-frontend/src/components/shared/Editor";
import { EditorWidget } from "../../types";
import { extractText } from "../../readValue";
import { WidgetRendererProps } from "../widgetRegistry";
import { useFacadeState } from "../../FacadeStateContext";
import { useWidgetActions } from "../../useWidgetActions";
import { usePressFeedback } from "../../pressFeedback";
import { useNotificationValue } from "./StatusIndicatorRenderer";

/**
 * A document or piece of code on the facade, in the Monaco editor.
 *
 * Unlike `text-input`, which starts from a fixed `defaultValue` and only writes
 * outward, an editor both reads what a service holds (`source` or `value`) and
 * sends what the person wrote back (`actions`, with `$$input` standing for the
 * document's text). Picking a different note in a sidebar updates `source`,
 * which replaces the editor buffer, and saving (or pressing Ctrl/Cmd+S) writes
 * the edited text back.
 */
export function EditorRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<EditorWidget>) {
  const said = useNotificationValue(boardContext, widget.source);
  const { state } = useFacadeState();
  const { run, prompt } = useWidgetActions(boardContext);

  const own =
    widget.value !== undefined
      ? typeof widget.value === "object" && widget.value !== null
        ? state[widget.value.$state]
        : widget.value
      : undefined;
  const rawSource = own !== undefined ? own : said;
  const sourcedText =
    rawSource !== undefined ? (extractText(rawSource) ?? "") : undefined;

  const initialText = sourcedText ?? widget.defaultValue ?? "";
  const [draft, setDraft] = useState<string>(initialText);
  const lastSourcedRef = useRef<string | undefined>(sourcedText);

  // Sync when the external source changes to a new value (e.g. a different note
  // is selected in the sidebar, or the first query result arrives).
  useEffect(() => {
    if (sourcedText !== undefined && sourcedText !== lastSourcedRef.current) {
      lastSourcedRef.current = sourcedText;
      setDraft(sourcedText);
    }
  }, [sourcedText]);

  const hasActions = !!(widget.action || widget.actions?.length);
  const canSubmit = hasActions && !widget.readOnly;
  const submitPress = usePressFeedback("primary", !canSubmit);

  const draftRef = useRef(draft);
  draftRef.current = draft;

  const submit = useCallback(() => {
    if (!canSubmit) {
      return;
    }
    const current = draftRef.current;
    // Record what was just sent so the echoed notification from our own save
    // is recognised as already in the buffer.
    lastSourcedRef.current = current;
    void run({
      action: widget.action,
      actions: widget.actions,
      value: current,
    });
  }, [canSubmit, widget.action, widget.actions, run]);

  const submitRef = useRef(submit);
  submitRef.current = submit;

  const mount: EditorMountHandler = (editor, monaco) => {
    const saveAction = editor.addAction({
      id: "facade-editor-save",
      label: widget.submitLabel ?? "Save",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => submitRef.current(),
    });
    return () => {
      saveAction.dispose();
    };
  };

  const grow = Boolean((widget as { grow?: boolean }).grow);
  const editorHeight = widget.height ?? (grow ? "100%" : 320);
  const showHeader = Boolean(widget.label || canSubmit);

  return (
    <div
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          submit();
        }
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        width: "100%",
        flex: grow ? 1 : undefined,
        minHeight: grow ? 240 : undefined,
      }}
    >
      {showHeader && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          {widget.label ? (
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              {widget.label}
            </label>
          ) : (
            <span />
          )}
          {canSubmit && (
            <button
              type="button"
              {...submitPress.handlers}
              onClick={submit}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: "transparent",
                backgroundColor: "hsl(var(--primary))",
                color: "hsl(var(--primary-foreground))",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 500,
                flexShrink: 0,
                ...submitPress.style,
              }}
            >
              {widget.submitLabel ?? "Save"}
            </button>
          )}
        </div>
      )}
      <div
        style={{
          flex: grow ? 1 : undefined,
          height: grow ? undefined : editorHeight,
          minHeight: grow ? 220 : typeof editorHeight === "number" ? editorHeight : 220,
          borderRadius: 8,
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "hsl(var(--border))",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Editor
          value={draft}
          language={widget.language ?? "markdown"}
          height={grow ? "100%" : editorHeight}
          initialWidth={0}
          readOnly={widget.readOnly}
          style={{ border: "none", flex: 1 }}
          onChange={(updated) => setDraft(updated ?? "")}
          onMount={mount}
          options={{
            ariaLabel: widget.label ?? "Editor",
            placeholder: widget.placeholder,
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: widget.lineNumbers === false ? "off" : "on",
            wordWrap: widget.wordWrap === false ? "off" : "on",
            padding: { top: 10, bottom: 10 },
            fontSize: 13,
          }}
        />
      </div>
      {prompt}
    </div>
  );
}
