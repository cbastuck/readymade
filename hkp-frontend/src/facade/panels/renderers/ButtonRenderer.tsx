import { ButtonWidget } from "../../types";
import { findService } from "../../findService";
import { WidgetRendererProps } from "../widgetRegistry";

export function ButtonRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<ButtonWidget>) {
  return (
    <button
      onClick={() => {
        const service = findService(boardContext, widget.action.serviceUuid);
        service?.configure(widget.action.configure);
      }}
      style={{
        padding: "9px 20px",
        borderRadius: 8,
        border: "1px solid hsl(var(--border))",
        background: "hsl(var(--card))",
        color: "hsl(var(--foreground))",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 500,
        fontFamily: "monospace",
        transition: "opacity 0.15s",
      }}
    >
      {widget.label}
    </button>
  );
}
