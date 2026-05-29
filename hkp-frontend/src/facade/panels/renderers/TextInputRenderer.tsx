import { useState, useCallback, useEffect, useRef } from "react";
import { TextInputWidget } from "../../types";
import { WidgetRendererProps } from "../widgetRegistry";
import { useVault } from "hkp-frontend/src/VaultContext";
import { vaultSet } from "hkp-frontend/src/vault";
import { useFacadeState } from "../../FacadeStateContext";
import { executeActions } from "../../executeActions";

export function TextInputRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<TextInputWidget>) {
  const [value, setValue] = useState("");
  const [vaultResolved, setVaultResolved] = useState<string | null>(null);
  const autoSubmitted = useRef(false);
  const { getSecret } = useVault();
  const { setState } = useFacadeState();

  useEffect(() => {
    if (!widget.vaultKey) {
      return;
    }
    const secret = getSecret(widget.vaultKey);
    if (secret) {
      setValue(secret);
      setVaultResolved(secret);
    }
  }, [widget.vaultKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-submit vault value to the service as soon as both are ready.
  useEffect(() => {
    const hasActions = widget.action || widget.actions?.length;
    if (!vaultResolved || !hasActions || autoSubmitted.current) {
      return;
    }
    autoSubmitted.current = true;
    executeActions({ action: widget.action, actions: widget.actions, value: vaultResolved, boardContext, setState });
  }, [vaultResolved]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text) {
      return;
    }
    if (widget.vaultKey) {
      vaultSet(widget.vaultKey, text);
    }
    executeActions({ action: widget.action, actions: widget.actions, value: text, boardContext, setState });
  }, [value, widget.action, widget.actions, widget.vaultKey, boardContext, setState]);

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
          type={widget.secret ? "password" : "text"}
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
