import { ButtonWidget } from "../../types";
import { WidgetRendererProps } from "../widgetRegistry";
import { useWidgetActions } from "../../useWidgetActions";
import { usePressFeedback } from "../../pressFeedback";
import {
  StatusDot,
  statusColor,
  useNotificationValue,
} from "./StatusIndicatorRenderer";

export function ButtonRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<ButtonWidget>) {
  const indicatorValue = useNotificationValue(
    boardContext,
    widget.indicator?.source,
  );
  const press = usePressFeedback(undefined, widget.disabled);
  const { run, prompt } = useWidgetActions(boardContext);

  return (
    <>
      <button
        {...press.handlers}
        disabled={widget.disabled}
        onClick={() => {
          void run({
            action: widget.action,
            actions: widget.actions,
            confirm: widget.confirm,
          });
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 20px",
          borderRadius: 8,
          border: "1px solid hsl(var(--border))",
          background: "hsl(var(--card))",
          color: "hsl(var(--foreground))",
          cursor: widget.disabled ? "default" : "pointer",
          opacity: widget.disabled ? 0.55 : 1,
          fontSize: 13,
          fontWeight: 500,
          fontFamily: "monospace",
          ...press.style,
        }}
      >
        {widget.indicator && (
          <StatusDot
            color={statusColor(indicatorValue, widget.indicator.statusColors)}
            size={8}
          />
        )}
        {widget.label}
      </button>
      {prompt}
    </>
  );
}
