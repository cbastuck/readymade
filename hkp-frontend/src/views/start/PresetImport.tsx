/**
 * Bringing a preset onto this device: a file from a disk, or a file from the
 * web.
 *
 * Both are the same act — a preset is a file either way — so they are one panel
 * with two ways in rather than two features. What arrives is kept on this
 * device, which is what puts it in the Presets source and in the menu of every
 * service of that kind.
 */

import { ChangeEvent, useRef, useState } from "react";

import {
  Preset,
  loadPresetsFromFile,
  loadPresetsFromUrl,
  savePreset,
} from "hkp-frontend/src/core/presets";

export default function PresetImport({ onClose }: { onClose: () => void }) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [imported, setImported] = useState<Preset[]>([]);

  const keep = (presets: Preset[]) => {
    for (const preset of presets) {
      savePreset(preset);
    }
    setImported((prev) => [...presets, ...prev]);
    setError("");
  };

  const report = (err: unknown) =>
    setError(err instanceof Error ? err.message : String(err));

  const onFetch = async () => {
    if (!url.trim()) {
      return;
    }
    setBusy(true);
    try {
      keep(await loadPresetsFromUrl(url.trim()));
      setUrl("");
    } catch (err) {
      report(err);
    } finally {
      setBusy(false);
    }
  };

  const onPickFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared so picking the same file twice is two events rather than one.
    event.target.value = "";
    if (!file) {
      return;
    }
    setBusy(true);
    try {
      keep(await loadPresetsFromFile(file));
    } catch (err) {
      report(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,22,28,0.32)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 40,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "min(70vh, 560px)",
          display: "flex",
          flexDirection: "column",
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 18px 48px rgba(20,22,28,0.28)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: "0 0 auto",
            padding: "14px 16px 12px",
            borderBottom: "1px solid #eceef3",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700 }}>Import a preset</div>
          <div style={{ marginTop: 3, fontSize: 12.5, color: "#6b7080" }}>
            A preset file configures one kind of service. It is filed under the
            service it names.
          </div>
        </div>

        <div
          className="st-v"
          style={{
            flex: "1 1 auto",
            overflowY: "auto",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="st-search"
              style={{ flex: "1 1 auto", minWidth: 0 }}
              value={url}
              placeholder="https://… or a GitHub link to a preset file"
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void onFetch();
                }
              }}
            />
            <button
              className="st-btn"
              disabled={busy || !url.trim()}
              onClick={() => void onFetch()}
            >
              Fetch
            </button>
          </div>

          <button
            className="st-btn"
            style={{ justifyContent: "center" }}
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            Choose a file…
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={(e) => void onPickFile(e)}
          />

          {error && (
            <div style={{ fontSize: 12.5, color: "#e0355f", lineHeight: 1.45 }}>
              {error}
            </div>
          )}

          {imported.length > 0 && (
            <div>
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
                Imported
              </div>
              {imported.map((preset) => (
                <div
                  key={`${preset.serviceId}:${preset.id}`}
                  style={{
                    fontSize: 12.5,
                    padding: "6px 0",
                    borderTop: "1px solid #eceef3",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{preset.name}</div>
                  <div style={{ fontSize: 11, color: "#9a9fae" }}>
                    {preset.serviceId}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            flex: "0 0 auto",
            padding: "10px 16px",
            borderTop: "1px solid #eceef3",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button className="st-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
