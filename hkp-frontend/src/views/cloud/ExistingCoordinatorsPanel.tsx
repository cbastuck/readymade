import { useState } from "react";
import { Network, Pencil } from "lucide-react";

import {
  RemoveButton,
  SettingsList,
  SettingsRow,
  SettingsSection,
} from "hkp-frontend/src/ui-components/settings/kit";
import EditServerForm from "hkp-frontend/src/ui-components/connections/EditServerForm";
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
              <EditServerForm
                name={coord.name}
                url={coord.url}
                normalizeUrl={toCoordinatorUrl}
                onCancel={() => setEditing(null)}
                onSave={({ name, url }) => {
                  onUpdate(coord, { ...coord, name, url });
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
