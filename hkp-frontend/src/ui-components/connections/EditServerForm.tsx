import { useState } from "react";

import { cleanAliases } from "hkp-frontend/src/runtime/board/remote";
import {
  SettingsButton,
  SettingsField,
  SettingsInput,
} from "hkp-frontend/src/ui-components/settings/kit";

type Props = {
  name: string;
  url: string;
  /**
   * The other names the server answers to. Given, the form offers them for
   * editing; left out, the row is for something that goes by one name only.
   */
  aliases?: string[];
  /** Names other servers already answer to, which this one cannot take. */
  takenNames?: string[];
  /** Applied to the typed URL before it is saved, so what is stored matches
   *  what the add form would have stored for the same role. */
  normalizeUrl?: (url: string) => string;
  onSave: (next: { name: string; url: string; aliases?: string[] }) => void;
  onCancel: () => void;
};

// The inline form a server row opens when it is edited: the two fields every
// server has, whichever role the row stands for. It renders inside the row so
// the list keeps its place, which is why it is a form rather than a dialog.
//
// A server that has aliases is renamed without losing the name it had: a board
// holds a name for as long as it exists, so the old one is put among the
// aliases as the new one is typed, where it can be seen and taken out again.
export default function EditServerForm({
  name: initialName,
  url: initialUrl,
  aliases: initialAliases,
  takenNames = [],
  normalizeUrl,
  onSave,
  onCancel,
}: Props) {
  const withAliases = initialAliases !== undefined;
  const [name, setName] = useState(initialName);
  const [url, setUrl] = useState(initialUrl);
  const [aliases, setAliases] = useState((initialAliases ?? []).join(", "));
  const [keptOldName, setKeptOldName] = useState(false);

  const namedAs = name.trim();
  const otherNames = cleanAliases(namedAs, aliases.split(","));
  const taken = [namedAs, ...otherNames].find((candidate) =>
    takenNames.includes(candidate),
  );
  const canSave = !!namedAs && !!url.trim() && !taken;

  const onChangeName = (value: string) => {
    setName(value);
    if (withAliases && !keptOldName && value.trim() !== initialName) {
      setKeptOldName(true);
      setAliases((current) =>
        cleanAliases("", [...current.split(","), initialName]).join(", "),
      );
    }
  };

  const save = () => {
    if (canSave) {
      const trimmed = url.trim();
      onSave({
        name: namedAs,
        url: normalizeUrl ? normalizeUrl(trimmed) : trimmed,
        ...(withAliases ? { aliases: otherNames } : {}),
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
          onChange={(ev) => onChangeName(ev.target.value)}
          onKeyDown={onKeyDown}
        />
      </SettingsField>
      {withAliases && (
        <SettingsField label="Also known as">
          <SettingsInput
            value={aliases}
            placeholder="node, python — names boards may use for it"
            onChange={(ev) => setAliases(ev.target.value)}
            onKeyDown={onKeyDown}
          />
        </SettingsField>
      )}
      {taken && (
        <div role="alert" style={{ fontSize: 12, color: "#b91c1c" }}>
          Another server already answers to “{taken}”.
        </div>
      )}
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
