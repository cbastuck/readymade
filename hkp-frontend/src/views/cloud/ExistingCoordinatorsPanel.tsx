import { useState } from "react";
import { Network, Pencil } from "lucide-react";

import {
  RemoveButton,
  SettingsButton,
  SettingsField,
  SettingsInput,
  SettingsList,
  SettingsRow,
  SettingsSection,
} from "hkp-frontend/src/ui-components/settings/kit";
import { toCoordinatorUrl } from "hkp-frontend/src/ui-components/connections/serverUrl";
import { CoordinatorDescriptor } from "../../common";

type Props = {
  coordinators: CoordinatorDescriptor[];
  onRemove: (coordinator: CoordinatorDescriptor) => void;
  /** Offers an edit on each row when set. */
  onUpdate?: (
    previous: CoordinatorDescriptor,
    next: CoordinatorDescriptor,
  ) => void;
};

// List rows rather than a table: a coordinator URL is long and unbreakable, so
// the row truncates it and fits whatever width the surface gives it — the
// settings dialog is far narrower than the Cloud Boards one. Mirrors the
// registered-remotes list, which sits next to this one in the settings dialog.
export default function ExistingCoordinatorsPanel({
  coordinators,
  onRemove,
  onUpdate,
}: Props) {
  // The row being edited, by index: two entries may share a name or a URL.
  const [editing, setEditing] = useState<number | null>(null);

  return (
    <SettingsSection label="Coordinators">
      <SettingsList empty="No coordinators added yet.">
        {coordinators.map((coord, idx) => (
          <SettingsRow
            key={`${coord.name}-${coord.url}-${idx}`}
            icon={<Network size={15} />}
            title={coord.name}
            subtitle={<span title={coord.url}>{coord.url}</span>}
            trailing={
              <>
                {onUpdate && editing !== idx && (
                  <button
                    className="hkp-set-icon-btn hkp-set-icon-btn--neutral"
                    onClick={() => setEditing(idx)}
                    aria-label={`Edit ${coord.name}`}
                  >
                    <Pencil size={14} />
                  </button>
                )}
                <RemoveButton
                  label={`Remove ${coord.name}`}
                  onClick={() => {
                    setEditing(null);
                    onRemove(coord);
                  }}
                />
              </>
            }
          >
            {onUpdate && editing === idx && (
              <EditCoordinatorForm
                coordinator={coord}
                onCancel={() => setEditing(null)}
                onSave={(next) => {
                  onUpdate(coord, next);
                  setEditing(null);
                }}
              />
            )}
          </SettingsRow>
        ))}
      </SettingsList>
    </SettingsSection>
  );
}

function EditCoordinatorForm({
  coordinator,
  onSave,
  onCancel,
}: {
  coordinator: CoordinatorDescriptor;
  onSave: (next: CoordinatorDescriptor) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(coordinator.name);
  const [url, setUrl] = useState(coordinator.url);
  const canSave = !!name.trim() && !!url.trim();

  const save = () => {
    if (canSave) {
      onSave({ ...coordinator, name: name.trim(), url: toCoordinatorUrl(url) });
    }
  };

  const onKeyDown = (ev: React.KeyboardEvent) => {
    if (ev.key === "Enter") {
      save();
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
