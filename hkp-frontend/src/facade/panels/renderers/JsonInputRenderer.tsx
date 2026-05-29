import { useState } from "react";
import { JsonInputWidget } from "../../types";
import { WidgetRendererProps } from "../widgetRegistry";
import { useFacadeState } from "../../FacadeStateContext";
import { executeActions } from "../../executeActions";
import JsonEditor from "hkp-frontend/src/ui-components/JsonEditor";

export function JsonInputRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<JsonInputWidget>) {
  const { state: facadeState, setState } = useFacadeState();

  const [value, setValue] = useState(() => {
    const dv = widget.defaultValue;
    if (
      dv !== null &&
      typeof dv === "object" &&
      !Array.isArray(dv) &&
      "$state" in dv
    ) {
      const key = (dv as { $state: string })["$state"];
      const stateVal = facadeState[key];
      if (stateVal !== undefined) {
        return stateVal;
      }
    }
    return dv !== undefined ? dv : widget.mode === "array" ? [] : {};
  });

  const submit = () => {
    executeActions({
      action: widget.action,
      actions: widget.actions,
      value,
      boardContext,
      setState,
    });
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
          width: widget.width,
        }}
      >
        <JsonEditor
          value={value}
          onChange={setValue}
          rootLabel={widget.mode}
          showBreadcrumbs={false}
        />

        <button onClick={submit} className="hkp-svc-btn w-full">
          {widget.submitLabel ?? "Apply"}
        </button>
      </div>
    </div>
  );
}
