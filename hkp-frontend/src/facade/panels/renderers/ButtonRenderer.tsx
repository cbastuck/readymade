import { ButtonWidget } from "../../types";
import { WidgetRendererProps } from "../widgetRegistry";
import { useFacadeState } from "../../FacadeStateContext";
import { executeActions } from "../../executeActions";
import {
  StatusDot,
  statusColor,
  useNotificationValue,
} from "./StatusIndicatorRenderer";

export function ButtonRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<ButtonWidget>) {
  const { state, setState } = useFacadeState();
  const indicatorValue = useNotificationValue(
    boardContext,
    widget.indicator?.source,
  );
  return (
    <button
      onClick={() => {
        executeActions({
          action: widget.action,
          actions: widget.actions,
          value: undefined,
          boardContext,
          setState,
          // Without this a { "$state": … } reference in the payload travels as
          // the reference object itself, and the service receives a shape it
          // cannot read rather than the value a widget published.
          state,
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
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 500,
        fontFamily: "monospace",
        transition: "opacity 0.15s",
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
  );
}
