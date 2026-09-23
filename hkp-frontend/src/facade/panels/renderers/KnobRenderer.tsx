import { useMemo, useCallback } from "react";
import Knob from "hkp-frontend/src/ui-components/Knob";
import { KnobWidget } from "../../types";
import { findService } from "../../boardServices";
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

  // A panel holds knob positions under this key. Two knobs driving the same
  // service — cols and rows of one image, say — are one service uuid and two
  // positions, so the key is the knob's own id where it has one.
  const knobKey = widget.id ?? widget.action.serviceUuid;
  const { markBoardChanged } = boardContext;

  const value = panelContext.knobValues[knobKey] ?? widget.defaultValue;

  const handleChange = useCallback(
    (v: number) => {
      panelContext.onKnobChange(knobKey, v);
      if (!service) {
        return;
      }
      const configure: Record<string, unknown> = {};
      for (const [k, tmpl] of Object.entries(widget.action.configure)) {
        configure[k] = applyValue(tmpl, v);
      }
      service.configure(configure);
      markBoardChanged?.();
    },
    [service, widget.action.configure, knobKey, panelContext, markBoardChanged],
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
