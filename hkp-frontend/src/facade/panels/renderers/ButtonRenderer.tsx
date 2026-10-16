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
  // A choice only where the board says so: an action button announced as
  // "not pressed" would read as a toggle that is off.
  const isChoice = widget.selected !== undefined;
  const selected = !!widget.selected;

  return (
    <>
      <button
        {...press.handlers}
        disabled={widget.disabled}
        aria-pressed={isChoice ? selected : undefined}
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
          // Longhand: the press feedback sets backgroundColor and borderColor,
          // and React warns when a shorthand is mixed with the value it covers.
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "hsl(var(--border))",
          backgroundColor: "hsl(var(--card))",
          color: "hsl(var(--foreground))",
          cursor: widget.disabled ? "default" : "pointer",
          opacity: widget.disabled ? 0.55 : 1,
          fontSize: 13,
          fontWeight: 500,
          fontFamily: "monospace",
          ...press.style,
          // After the press feedback, so hovering the chosen one does not
          // make it look like any other for as long as the pointer is on it.
          ...(selected
            ? {
                borderColor: "var(--hkp-accent, #3b5bff)",
                backgroundColor:
                  "color-mix(in srgb, var(--hkp-accent, #3b5bff) 12%, hsl(var(--card)))",
                fontWeight: 600,
              }
            : {}),
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
