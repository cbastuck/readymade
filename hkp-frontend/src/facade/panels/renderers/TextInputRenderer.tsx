import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { TextInputWidget } from "../../types";
import { findService } from "../../findService";
import { WidgetRendererProps } from "../widgetRegistry";
import { useVault } from "hkp-frontend/src/VaultContext";
import { vaultSet } from "hkp-frontend/src/vault";
import { applyInput } from "../../applyInput";

export function TextInputRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<TextInputWidget>) {
  const [value, setValue] = useState("");
  const [vaultResolved, setVaultResolved] = useState<string | null>(null);
  const autoSubmitted = useRef(false);
  const { getSecret } = useVault();

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

  const service = useMemo(
    () =>
      widget.action
        ? findService(boardContext, widget.action.serviceUuid)
        : null,
    [boardContext.scopes, boardContext.services, widget.action?.serviceUuid],
  );

  // Auto-submit vault value to the service as soon as both are ready.
  useEffect(() => {
    if (!vaultResolved || !service || !widget.action || autoSubmitted.current) {
      return;
    }
    autoSubmitted.current = true;
    const configure: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(widget.action.configure)) {
      configure[k] = applyInput(v, vaultResolved);
    }
    service.configure(configure);
  }, [vaultResolved, service]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text) {
      return;
    }
    if (widget.vaultKey) {
      vaultSet(widget.vaultKey, text);
    }
    if (service && widget.action) {
      const configure: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(widget.action.configure)) {
        configure[k] = applyInput(v, text);
      }
      service.configure(configure);
    }
  }, [value, service, widget.action, widget.vaultKey]);

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
