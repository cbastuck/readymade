/**
 * What a preset is, in the details column.
 *
 * A preset is a file, so this reads like one: where it came from, what service
 * it configures, what it needs before it will work, and — since the whole thing
 * is small enough to look at — the configuration itself. The two actions are
 * the two things that can happen to a file here: write it out, or delete it.
 * Applying one happens in the playground, on a service.
 */

import { useState } from "react";

import { PresetNode } from "./types";
import {
  normalizeTags,
  presetSecrets,
  serializePreset,
} from "hkp-frontend/src/core/presets";
import { unavailableSecrets } from "hkp-frontend/src/core/secrets";

const PRESET_ART = "linear-gradient(160deg, #6b5bd6, #3d2fa8)";

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--st-mut)",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "#4a4f5e",
          wordBreak: "break-word",
          lineHeight: 1.4,
        }}
      >
        {value}
      </div>
    </div>
  );
}

/** Hands the preset to the browser as the file it is shared as. */
function download(node: PresetNode): void {
  const blob = new Blob([serializePreset(node.preset)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${node.preset.id}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Where a preset is filed, and — when it is one this device keeps — the field
 * that changes it.
 *
 * Tags are part of the file rather than a note beside it, so editing them here
 * rewrites the preset: the filing is what travels when it is exported, and what
 * someone else's copy is organised by too.
 */
function Tags({ node }: { node: PresetNode }) {
  const tags = node.preset.tags ?? [];
  const [draft, setDraft] = useState(tags.join(", "));

  const commit = () => {
    const next = normalizeTags(draft.split(",")) ?? [];
    if (next.join("\u0000") !== tags.join("\u0000")) {
      node.onRetag?.(next);
    }
  };

  if (!node.onRetag) {
    return tags.length ? (
      <MetaRow label="Tags" value={tags.join(", ")} />
    ) : null;
  }

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--st-mut)",
          marginBottom: 3,
        }}
      >
        Tags
      </div>
      <input
        className="st-search"
        style={{ width: "100%" }}
        value={draft}
        placeholder="messaging, audio — comma separated"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
          }
        }}
      />
      <div style={{ fontSize: 11, color: "#9a9fae", marginTop: 3 }}>
        Where it is filed under {node.preset.serviceId}.
      </div>
    </div>
  );
}

export default function PresetDetails({ node }: { node: PresetNode }) {
  const { preset } = node;
  const [showState, setShowState] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const secrets = presetSecrets(preset);
  const missing = unavailableSecrets(preset.state);

  return (
    <div
      style={{
        flex: "0 0 300px",
        width: 300,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          padding: "13px 14px 11px",
          borderBottom: "1px solid #eceef3",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--st-mut)",
          }}
        >
          Preset
        </span>
      </div>

      <div
        className="st-v"
        style={{
          flex: "1 1 auto",
          overflowY: "auto",
          padding: "22px 18px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: 18,
            background: PRESET_ART,
            flex: "0 0 auto",
          }}
        />

        <div style={{ textAlign: "center", minWidth: 0, width: "100%" }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: "-0.01em",
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
              color: "#6b7080",
            }}
          >
            {node.builtIn ? "Built in" : "Saved on this device"}
          </div>
        </div>

        {preset.description && (
          <div
            style={{
              fontSize: 12.5,
              lineHeight: 1.55,
              color: "#4a4f5e",
              width: "100%",
            }}
          >
            {preset.description}
          </div>
        )}

        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <MetaRow label="Service" value={preset.serviceId} />
          {preset.serviceName && (
            <MetaRow label="Names the service" value={preset.serviceName} />
          )}
          {preset.runtimes?.length ? (
            <MetaRow label="Meant for" value={preset.runtimes.join(", ")} />
          ) : null}
          {preset.author && <MetaRow label="Author" value={preset.author} />}
          <Tags node={node} />
        </div>

        {secrets.length > 0 && (
          <div style={{ width: "100%" }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--st-mut)",
                marginBottom: 4,
              }}
            >
              Needs
            </div>
            {secrets.map((alias) => {
              const info = preset.secrets?.[alias];
              const absent = missing.includes(alias);
              return (
                <div
                  key={alias}
                  style={{
                    fontSize: 12.5,
                    padding: "5px 0",
                    borderTop: "1px solid #eceef3",
                    color: absent ? "#b45309" : "#4a4f5e",
                  }}
                >
                  {info?.url ? (
                    <a
                      href={info.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "inherit" }}
                    >
                      {info.label ?? alias}
                    </a>
                  ) : (
                    (info?.label ?? alias)
                  )}
                  <div style={{ fontSize: 11, color: "#9a9fae" }}>
                    {absent
                      ? `secret "${alias}" — not on this device`
                      : `secret "${alias}"`}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {preset.homepage && (
          <a
            className="st-btn st-btn-ghost"
            style={{ justifyContent: "center", width: "100%" }}
            href={preset.homepage}
            target="_blank"
            rel="noopener noreferrer"
          >
            API documentation
          </a>
        )}

        <div style={{ width: "100%" }}>
          <button
            className="st-btn st-btn-ghost"
            style={{ justifyContent: "center", width: "100%" }}
            onClick={() => setShowState((v) => !v)}
          >
            {showState ? "Hide configuration" : "Show configuration"}
          </button>
          {showState && (
            <pre
              style={{
                marginTop: 8,
                fontSize: 11,
                lineHeight: 1.45,
                background: "#f7f8fa",
                border: "1px solid #eceef3",
                borderRadius: 8,
                padding: 10,
                overflowX: "auto",
                whiteSpace: "pre",
              }}
            >
              {JSON.stringify(preset.state, null, 2)}
            </pre>
          )}
        </div>

        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <button
            className="st-btn st-btn-ghost"
            style={{ justifyContent: "center", width: "100%" }}
            onClick={() => download(node)}
          >
            Export file
          </button>
          {node.onDelete && (
            <button
              className="st-btn st-btn-ghost"
              style={{
                justifyContent: "center",
                width: "100%",
                color: confirmDelete ? "#b42318" : undefined,
              }}
              onClick={() => {
                if (confirmDelete) {
                  node.onDelete!();
                } else {
                  setConfirmDelete(true);
                }
              }}
              onBlur={() => setConfirmDelete(false)}
            >
              {confirmDelete ? "Delete — click again" : "Delete preset"}
            </button>
          )}
          {node.builtIn && (
            <div
              style={{
                fontSize: 11.5,
                color: "#9a9fae",
                textAlign: "center",
                lineHeight: 1.4,
              }}
            >
              Shipped with this build. Export it to keep an edited copy.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
