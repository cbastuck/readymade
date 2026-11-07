import { useEffect, useState, type CSSProperties } from "react";

import BottomSheet from "./BottomSheet";
import MobileIcon from "./MobileIcon";
import { M } from "./tokens";
import { useBoardContext } from "../../../BoardContext";
import { RuntimeDescriptor, ServiceDescriptor } from "../../../types";
import { usePresetsForService } from "../../../ui-components/service/usePresetsForService";
import { applyPresetTo } from "../../../ui-components/service/PresetMenu";
import { savePresetFrom } from "../../../ui-components/service/SavePresetDialog";

/**
 * A service's presets on a phone: the desktop's menu (`PresetMenu`) and its
 * save dialog (`SavePresetDialog`) in one sheet, since both answer the same
 * question about the same service. Managing them — importing, deleting — is the
 * start page's Presets source, as on the desktop.
 */

type Props = {
  open: boolean;
  onClose: () => void;
  service: ServiceDescriptor;
  runtime: RuntimeDescriptor;
  /**
   * Whether a preset may be applied here. Applying recreates the service, which
   * a board that is only attached to — a deployed one — does not take; keeping
   * its configuration as a preset it does.
   */
  canApply: boolean;
};

const label: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  color: M.textMuted,
  textTransform: "uppercase",
  marginBottom: 8,
};

// Anything smaller than 16px zooms iOS in on focus, and it stays zoomed.
const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  height: 44,
  padding: "0 12px",
  border: `1.5px solid ${M.border}`,
  borderRadius: 10,
  background: M.card,
  fontSize: 16,
  color: M.textPrimary,
  outline: "none",
  fontFamily: "inherit",
};

export default function PresetsSheet({
  open,
  onClose,
  service,
  runtime,
  canApply,
}: Props) {
  const boardContext = useBoardContext();
  const presets = usePresetsForService(service.serviceId);
  const [name, setName] = useState(service.serviceName ?? "");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(service.serviceName ?? "");
      setTags("");
      setError("");
    }
  }, [open, service.serviceName]);

  const save = async () => {
    if (!boardContext || !name.trim()) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await savePresetFrom(boardContext, runtime, service, name, tags);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Presets" height="75%">
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {canApply && (
          <div>
            <div style={label}>Apply</div>
            {presets.length === 0 ? (
              <div style={{ fontSize: 13, color: M.textMuted }}>
                No presets for {service.serviceId} yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {presets.map((preset) => (
                  <button
                    key={`${preset.serviceId}:${preset.id}`}
                    onClick={() => {
                      if (boardContext) {
                        onClose();
                        void applyPresetTo(boardContext, preset, runtime, service.uuid);
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "11px 14px",
                      border: `1px solid ${M.border}`,
                      borderRadius: 12,
                      background: M.card,
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                    }}
                  >
                    <MobileIcon name="bookmark" size={16} color={M.tealDark} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: M.textPrimary }}>
                        {preset.name}
                      </div>
                      {(preset.description || preset.tags?.length) && (
                        <div style={{ fontSize: 12, color: M.textMuted, marginTop: 2 }}>
                          {preset.description ?? preset.tags?.join(", ")}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <div style={label}>Save this configuration</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              aria-label="Preset name"
              placeholder="Name it — “Weather API, metric”"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={input}
              spellCheck={false}
            />
            <input
              aria-label="Preset tags"
              placeholder="Tags — messaging, audio (comma separated)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              style={input}
              spellCheck={false}
              autoCapitalize="off"
            />
            <div style={{ fontSize: 12, color: M.textMuted, lineHeight: 1.4 }}>
              It becomes a preset for every {service.serviceId}, in the Presets
              source on the start page. Secret references travel with it; the
              values never do.
            </div>
            {error && <div style={{ fontSize: 12, color: M.danger }}>{error}</div>}
            <button
              disabled={busy || !name.trim()}
              onClick={() => void save()}
              style={{
                height: 46,
                border: "none",
                borderRadius: 12,
                background: M.teal,
                color: "#fff",
                fontFamily: "inherit",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                opacity: busy || !name.trim() ? 0.45 : 1,
              }}
            >
              {busy ? "Saving…" : "Save as preset"}
            </button>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
