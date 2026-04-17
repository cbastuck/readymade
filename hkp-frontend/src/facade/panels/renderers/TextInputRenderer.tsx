import { useState, useMemo, useCallback } from "react";
import { TextInputWidget } from "../../types";
import { findService } from "../../findService";
import { WidgetRendererProps } from "../widgetRegistry";

function applyInput(template: unknown, input: string): unknown {
  if (typeof template === "string") {
    return template.replace("$$input", input);
  }
  return template;
}

export function TextInputRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<TextInputWidget>) {
  const [value, setValue] = useState("");

  const service = useMemo(
    () => findService(boardContext, widget.action.serviceUuid),
    [boardContext.scopes, boardContext.services, widget.action.serviceUuid],
  );

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text || !service) {
      return;
    }
    const configure: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(widget.action.configure)) {
      configure[k] = applyInput(v, text);
    }
    service.configure(configure);
  }, [value, service, widget.action.configure]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        width: "100%",
        maxWidth: 360,
      }}
    >
      {widget.label && (
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
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={widget.placeholder}
          spellCheck={false}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--muted))",
            color: "hsl(var(--foreground))",
            fontSize: 13,
            outline: "none",
            fontFamily: "monospace",
          }}
        />
        <button
          onClick={submit}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            background: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          {widget.submitLabel ?? "Set"}
        </button>
      </div>
    </div>
  );
}
