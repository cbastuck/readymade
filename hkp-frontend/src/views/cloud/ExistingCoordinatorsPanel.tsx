import { Network } from "lucide-react";

import {
  RemoveButton,
  SettingsList,
  SettingsRow,
  SettingsSection,
} from "hkp-frontend/src/ui-components/settings/kit";
import { CoordinatorDescriptor } from "../../common";

type Props = {
  coordinators: CoordinatorDescriptor[];
  onRemove: (coordinator: CoordinatorDescriptor) => void;
};

// List rows rather than a table: a coordinator URL is long and unbreakable, so
// the row truncates it and fits whatever width the surface gives it — the
// settings dialog is far narrower than the Cloud Boards one. Mirrors the
// registered-remotes list, which sits next to this one in the settings dialog.
export default function ExistingCoordinatorsPanel({
  coordinators,
  onRemove,
}: Props) {
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
              <RemoveButton
                label={`Remove ${coord.name}`}
                onClick={() => onRemove(coord)}
              />
            }
          />
        ))}
      </SettingsList>
    </SettingsSection>
  );
}
