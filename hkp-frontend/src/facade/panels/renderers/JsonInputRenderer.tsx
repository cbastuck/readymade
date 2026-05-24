import { useMemo, useState } from "react";
import { JsonInputWidget } from "../../types";
import { findService } from "../../findService";
import { WidgetRendererProps } from "../widgetRegistry";
import { applyInput } from "../../applyInput";
import JsonEditor from "hkp-frontend/src/ui-components/JsonEditor";

function seedValue(widget: JsonInputWidget): unknown {
  if (widget.defaultValue !== undefined) {
    return widget.defaultValue;
  }
  return widget.mode === "array" ? [] : {};
}

export function JsonInputRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<JsonInputWidget>) {
  const [value, setValue] = useState(() => seedValue(widget));

  const service = useMemo(
    () => findService(boardContext, widget.action.serviceUuid),
    [boardContext.scopes, boardContext.services, widget.action.serviceUuid],
  );

  const submit = () => {
    if (!service) {
      return;
    }
    const configure: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(widget.action.configure)) {
      configure[k] = applyInput(v, value);
    }
    service.configure(configure);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        width: "100%",
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
      <div
        style={{
          border: "1px solid hsl(var(--border))",
          borderRadius: 8,
          padding: "8px 12px",
          background: "hsl(var(--card))",
          minHeight: 80,
          maxHeight: 240,
          overflowY: "auto",
        }}
      >
        <JsonEditor value={value} onChange={setValue} rootLabel={widget.mode} />
      </div>
      <button
        onClick={submit}
        className="hkp-svc-btn"
        style={{ alignSelf: "flex-start" }}
      >
        {widget.submitLabel ?? "Apply"}
      </button>
    </div>
  );
}
