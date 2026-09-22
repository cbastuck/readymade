import { useState } from "react";

import {
  SettingsButton,
  SettingsField,
  SettingsInput,
} from "hkp-frontend/src/ui-components/settings/kit";

type Props = {
  name: string;
  url: string;
  /** Applied to the typed URL before it is saved, so what is stored matches
   *  what the add form would have stored for the same role. */
  normalizeUrl?: (url: string) => string;
  onSave: (next: { name: string; url: string }) => void;
  onCancel: () => void;
};

// The inline form a server row opens when it is edited: the two fields every
// server has, whichever role the row stands for. It renders inside the row so
// the list keeps its place, which is why it is a form rather than a dialog.
export default function EditServerForm({
  name: initialName,
  url: initialUrl,
  normalizeUrl,
  onSave,
  onCancel,
}: Props) {
  const [name, setName] = useState(initialName);
  const [url, setUrl] = useState(initialUrl);
  const canSave = !!name.trim() && !!url.trim();

  const save = () => {
    if (canSave) {
      const trimmed = url.trim();
      onSave({
        name: name.trim(),
        url: normalizeUrl ? normalizeUrl(trimmed) : trimmed,
      });
    }
  };

  const onKeyDown = (ev: React.KeyboardEvent) => {
    if (ev.key === "Enter") {
      save();
    }
    if (ev.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "2px 12px 12px 56px",
      }}
    >
      <SettingsField label="Name">
        <SettingsInput
          value={name}
          autoFocus
          onChange={(ev) => setName(ev.target.value)}
          onKeyDown={onKeyDown}
        />
      </SettingsField>
      <SettingsField label="URL">
        <SettingsInput
          mono
          value={url}
          onChange={(ev) => setUrl(ev.target.value)}
          onKeyDown={onKeyDown}
        />
      </SettingsField>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <SettingsButton onClick={onCancel}>Cancel</SettingsButton>
        <SettingsButton variant="primary" onClick={save} disabled={!canSave}>
          Save
        </SettingsButton>
      </div>
    </div>
  );
}
