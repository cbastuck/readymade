import { useState } from "react";

import {
  SettingsButton,
  SettingsField,
  SettingsInput,
} from "hkp-frontend/src/ui-components/settings/kit";
import { RuntimeClass } from "hkp-frontend/src/types";
import { CoordinatorDescriptor } from "hkp-frontend/src/common";

type Props = {
  /** Omitted when the host cannot register runtimes; the form then adds
   *  coordinators only. */
  onAddRuntime?: (rt: RuntimeClass) => void;
  /** Omitted when the host keeps no coordinators; the form then adds runtimes
   *  only. */
  onAddCoordinator?: (coordinator: CoordinatorDescriptor) => void;
  onCancel?: () => void;
};

const COORDINATOR_PATH = "/coordinator";

// The server's base URL, without a trailing slash or coordinator path.
function toBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  return trimmed.endsWith(COORDINATOR_PATH)
    ? trimmed.slice(0, -COORDINATOR_PATH.length)
    : trimmed;
}

// One form for a server that may host runtimes, coordinate boards, or both:
// the runtime is registered at the base URL, the coordinator under
// `<base>/coordinator`. Runtimes are always registered as REST.
export default function NewConnectionPanel({
  onAddRuntime,
  onAddCoordinator,
  onCancel,
}: Props) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [asRuntime, setAsRuntime] = useState(!!onAddRuntime);
  const [asCoordinator, setAsCoordinator] = useState(!onAddRuntime);

  const offersBoth = !!onAddRuntime && !!onAddCoordinator;
  const addsRuntime = !!onAddRuntime && asRuntime;
  const addsCoordinator = !!onAddCoordinator && asCoordinator;
  const canSubmit = !!name && !!url.trim() && (addsRuntime || addsCoordinator);

  const onSubmit = () => {
    if (!canSubmit) {
      return;
    }
    const base = toBaseUrl(url);
    if (addsRuntime) {
      onAddRuntime!({ type: "rest", name, url: base });
    }
    if (addsCoordinator) {
      onAddCoordinator!({ name, url: `${base}${COORDINATOR_PATH}` });
    }
    setName("");
    setUrl("");
  };

  return (
    <div className="hkp-set-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SettingsField label="Name" htmlFor="connection-name">
        <SettingsInput
          id="connection-name"
          placeholder="My Server"
          value={name}
          onChange={(ev) => setName(ev.target.value)}
        />
      </SettingsField>

      <SettingsField label="Server URL" htmlFor="connection-url">
        <SettingsInput
          id="connection-url"
          mono
          placeholder="http://127.0.0.1:8080"
          value={url}
          onChange={(ev) => setUrl(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              onSubmit();
            }
          }}
        />
      </SettingsField>

      {offersBoth && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label className="hkp-set-check">
            <input
              type="checkbox"
              checked={asRuntime}
              onChange={(ev) => setAsRuntime(ev.target.checked)}
            />
            <span style={{ fontWeight: 600 }}>
              Runtime server
              <span className="hkp-set-row-sub" style={{ display: "block", whiteSpace: "normal", fontWeight: 400 }}>
                Run services from boards on it
              </span>
            </span>
          </label>
          <label className="hkp-set-check">
            <input
              type="checkbox"
              checked={asCoordinator}
              onChange={(ev) => setAsCoordinator(ev.target.checked)}
            />
            <span style={{ fontWeight: 600 }}>
              Coordinator
              <span className="hkp-set-row-sub" style={{ display: "block", whiteSpace: "normal", fontWeight: 400 }}>
                Deploy boards to it and open cloud boards
              </span>
            </span>
          </label>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        {onCancel && <SettingsButton onClick={onCancel}>Cancel</SettingsButton>}
        <SettingsButton variant="primary" onClick={onSubmit} disabled={!canSubmit}>
          Add server
        </SettingsButton>
      </div>
    </div>
  );
}
