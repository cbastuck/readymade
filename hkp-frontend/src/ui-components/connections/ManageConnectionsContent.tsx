import { useState } from "react";
import { Plus } from "lucide-react";

import {
  SettingsButton,
  SettingsSection,
  SettingsStack,
} from "hkp-frontend/src/ui-components/settings/kit";
import { RuntimeClass } from "hkp-frontend/src/types";
import { CoordinatorDescriptor } from "hkp-frontend/src/common";
import ExistingRuntimesPanel from "hkp-frontend/src/ui-components/toolbar/ExistingRuntimesPanel";
import DiscoverRuntimesPanel from "hkp-frontend/src/ui-components/toolbar/DiscoverRuntimesPanel";
import ExistingCoordinatorsPanel from "hkp-frontend/src/views/cloud/ExistingCoordinatorsPanel";
import type {
  CoordinatorsController,
  RemotesController,
} from "hkp-frontend/src/views/start/types";

import NewConnectionPanel from "./NewConnectionPanel";

type Props = {
  /** The remote runtimes the host keeps; omitted when it keeps none. */
  remotes?: RemotesController;
  /** The coordinators the host keeps; omitted when it keeps none. */
  coordinators?: CoordinatorsController;
};

// Every server this host knows about, in both roles — runtime server and
// coordinator — with one form to add a server in either role or both, since a
// coordinator usually serves runtimes too. The add form renders inline, so it
// works in narrow surfaces and above the popover layer (bottom sheets).
export default function ManageConnectionsContent({
  remotes,
  coordinators,
}: Props) {
  const [showNewPanel, setShowNewPanel] = useState(false);

  const onAddRuntime = remotes
    ? (rt: RuntimeClass) => {
        remotes.onAdd(rt);
        setShowNewPanel(false);
      }
    : undefined;

  const onAddCoordinator = coordinators
    ? (coordinator: CoordinatorDescriptor) => {
        coordinators.onAdd(coordinator);
        setShowNewPanel(false);
      }
    : undefined;

  return (
    <div className="hkp-set">
      <SettingsStack>
        {remotes && (
          <ExistingRuntimesPanel
            remoteRuntimes={remotes.runtimes}
            onRemoveRuntime={remotes.onRemove}
            onChangeRuntimeColor={(rt, color) =>
              remotes.onUpdate(rt, { ...rt, color })
            }
            onUpdateRuntime={remotes.onUpdate}
          />
        )}

        {coordinators && (
          <ExistingCoordinatorsPanel
            coordinators={coordinators.coordinators}
            onRemove={coordinators.onRemove}
            onUpdate={coordinators.onUpdate}
          />
        )}

        {remotes && (
          <DiscoverRuntimesPanel
            existing={remotes.runtimes}
            onAdd={remotes.onAdd}
          />
        )}

        {showNewPanel ? (
          <SettingsSection label="Add a server">
            <NewConnectionPanel
              onAddRuntime={onAddRuntime}
              onAddCoordinator={onAddCoordinator}
              onCancel={() => setShowNewPanel(false)}
            />
          </SettingsSection>
        ) : (
          <SettingsButton variant="block" onClick={() => setShowNewPanel(true)}>
            <Plus size={14} />
            Add a server
          </SettingsButton>
        )}
      </SettingsStack>
    </div>
  );
}
