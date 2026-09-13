import { useState, type ReactNode } from "react";

import { M } from "../../playground/mobile/tokens";
import { PresetNode } from "../types";
import { presetSecrets, serializePreset } from "hkp-frontend/src/core/presets";
import { unavailableSecrets } from "hkp-frontend/src/core/secrets";

const PRESET_ART = "linear-gradient(160deg, #6b5bd6, #3d2fa8)";

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "0 4px" }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: M.textMuted,
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13.5,
          color: M.textSecondary,
          wordBreak: "break-word",
          lineHeight: 1.4,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Action({
  children,
  onClick,
  tone,
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: "danger";
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        boxSizing: "border-box",
        padding: "13px 14px",
        borderRadius: 12,
        border: `1px solid ${M.border}`,
        background: M.card,
        color: tone === "danger" ? "#e0355f" : M.textPrimary,
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}

/**
 * A preset as a pushed page: what it configures, what it needs, and what is in
 * it. The mobile counterpart of the desktop PresetDetails column — the same
 * file, read the same way. Applying one happens on a service in a board.
 */
export default function MobilePresetDetails({ node }: { node: PresetNode }) {
  const { preset } = node;
  const [showState, setShowState] = useState(false);
  const secrets = presetSecrets(preset);
  const missing = unavailableSecrets(preset.state);

  const download = () => {
    const blob = new Blob([serializePreset(preset)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${preset.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "20px 16px calc(24px + env(safe-area-inset-bottom))",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 92,
            height: 92,
            borderRadius: 20,
            background: PRESET_ART,
          }}
        />
        <div style={{ textAlign: "center", minWidth: 0, width: "100%" }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 18,
              color: M.textPrimary,
              lineHeight: 1.3,
            }}
          >
            {preset.name}
          </div>
          <div
            style={{
              marginTop: 5,
              fontSize: 12,
              fontWeight: 600,
              color: M.textSecondary,
            }}
          >
            {node.builtIn ? "Built in" : "Saved on this device"}
          </div>
        </div>
      </div>

      {preset.description && (
        <div
          style={{
            fontSize: 13.5,
            lineHeight: 1.55,
            color: M.textSecondary,
            padding: "0 4px",
          }}
        >
          {preset.description}
        </div>
      )}

      <MetaRow label="Service" value={preset.serviceId} />
      {preset.runtimes?.length ? (
        <MetaRow label="Meant for" value={preset.runtimes.join(", ")} />
      ) : null}
      {secrets.length > 0 && (
        <MetaRow
          label="Needs"
          value={secrets
            .map((alias) =>
              missing.includes(alias)
                ? `${alias} — not on this device`
                : alias,
            )
            .join(", ")}
        />
      )}

      <Action onClick={() => setShowState((v) => !v)}>
        {showState ? "Hide configuration" : "Show configuration"}
      </Action>
      {showState && (
        <pre
          style={{
            margin: 0,
            padding: "10px 12px",
            background: M.bg,
            borderRadius: 10,
            fontSize: 11,
            lineHeight: 1.5,
            color: M.textSecondary,
            overflowX: "auto",
            whiteSpace: "pre",
          }}
        >
          {JSON.stringify(preset.state, null, 2)}
        </pre>
      )}

      <Action onClick={download}>Export file</Action>
      {node.onDelete && (
        <Action tone="danger" onClick={() => node.onDelete!()}>
          Delete preset
        </Action>
      )}
    </div>
  );
}
