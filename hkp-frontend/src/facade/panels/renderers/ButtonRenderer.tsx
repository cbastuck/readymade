import { ButtonWidget } from "../../types";
import { WidgetRendererProps } from "../widgetRegistry";
import { useFacadeState } from "../../FacadeStateContext";
import { executeActions } from "../../executeActions";

export function ButtonRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<ButtonWidget>) {
  const { setState } = useFacadeState();
  return (
    <button
      onClick={() => {
        executeActions({ action: widget.action, actions: widget.actions, value: undefined, boardContext, setState });
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
