import { useMemo, useCallback } from "react";
import Knob from "hkp-frontend/src/ui-components/Knob";
import { KnobWidget } from "../../types";
import { findService } from "../../findService";
import { WidgetRendererProps } from "../widgetRegistry";

function applyValue(template: unknown, value: number): unknown {
  if (typeof template === "string") {
    return template.replace(/\{\{value\}\}/g, String(Math.round(value)));
  }
  if (Array.isArray(template)) {
    return template.map((item) => applyValue(item, value));
  }
  return template;
}

export function KnobRenderer({
  widget,
  boardContext,
  panelContext,
}: WidgetRendererProps<KnobWidget>) {
  const service = useMemo(
    () => findService(boardContext, widget.action.serviceUuid),
    [boardContext.scopes, boardContext.services, widget.action.serviceUuid],
  );

  const value =
    panelContext.knobValues[widget.action.serviceUuid] ?? widget.defaultValue;

  const handleChange = useCallback(
    (v: number) => {
      panelContext.onKnobChange(widget.action.serviceUuid, v);
      if (!service) {
        return;
      }
      const configure: Record<string, unknown> = {};
      for (const [k, tmpl] of Object.entries(widget.action.configure)) {
        configure[k] = applyValue(tmpl, v);
      }
      service.configure(configure);
    },
    [service, widget.action.configure, widget.action.serviceUuid, panelContext],
  );

  const unit = widget.unit ?? "";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {widget.label && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          {widget.label}
        </div>
      )}
      <Knob
        value={value}
        min={widget.min}
        max={widget.max}
        width={widget.width}
        height={widget.height}
        markers={widget.markers}
        onChange={handleChange}
      />
      {(widget.showValue ?? true) && (
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            fontFamily: "monospace",
            color: "hsl(var(--foreground))",
            letterSpacing: "-0.02em",
          }}
        >
          {Math.round(value)}
          {unit && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                marginLeft: 3,
                color: "hsl(var(--muted-foreground))",
              }}
            >
              {unit}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
