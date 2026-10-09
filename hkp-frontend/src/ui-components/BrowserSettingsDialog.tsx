import { Network } from "lucide-react";

import { useBoardContext } from "hkp-frontend/src/BoardContext";
import {
  isRuntimeGraphQLClassType,
  isRuntimeRestClassType,
  RuntimeClass,
} from "hkp-frontend/src/types";
import { useLocalStorageCoordinators } from "hkp-frontend/src/views/start/useLocalStorageCoordinators";
import { useLocalStorageRemotes } from "hkp-frontend/src/views/start/useLocalStorageRemotes";
import type {
  CoordinatorsController,
  RemotesController,
} from "hkp-frontend/src/views/start/types";

import ManageConnectionsContent from "./connections/ManageConnectionsContent";
import SettingsDialog from "./SettingsDialog";
import { licencesTab } from "./settings/licencesTab";
import { useRemoteRuntimeEditing } from "./toolbar/useRemoteRuntimeEditing";

export const CONNECTIONS_TAB = "connections";

/** The servers a view keeps, in both roles. */
type Connections = {
  remotes: RemotesController;
  coordinators: CoordinatorsController;
};

type Props = {
  /** The open tab; null closes the dialog. */
  tab: string | null;
  onChangeTab: (tab: string | null) => void;
  /**
   * The controllers of a view that lists these servers itself, so the tab and
   * the view act on one list. Without them the tab keeps its own, read when it
   * opens.
   */
  connections?: Connections;
};

/**
 * The settings of a browser host, the same wherever they are opened from:
 * Appearance, the servers this browser knows, and the licences of the bundle
 * it was served — no native code, so a shorter list than any of the apps.
 */
export default function BrowserSettingsDialog({
  tab,
  onChangeTab,
  connections,
}: Props) {
  return (
    <SettingsDialog
      tab={tab}
      onChangeTab={onChangeTab}
      extraTabs={[
        {
          id: CONNECTIONS_TAB,
          label: "Connections",
          icon: <Network size={15} />,
          content: connections ? (
            <ManageConnectionsContent {...connections} />
          ) : (
            <StoredConnections />
          ),
        },
        licencesTab("website"),
      ]}
    />
  );
}

const isRemoteRuntime = (rt: RuntimeClass) =>
  isRuntimeGraphQLClassType(rt.type) || isRuntimeRestClassType(rt.type);

function StoredConnections() {
  // On a board the remotes are its engine pool, so a server added here is in
  // the runtime picker at once; with no board they are the stored list that
  // pool starts from. Both end up in the same localStorage entry.
  const boardContext = useBoardContext();
  const boardRemotes = useRemoteRuntimeEditing();
  const storedRemotes = useLocalStorageRemotes();
  const coordinators = useLocalStorageCoordinators();

  const remotes: RemotesController = boardContext
    ? {
        runtimes: boardContext.availableRuntimeEngines.filter(isRemoteRuntime),
        onAdd: boardRemotes.onAdd,
        onRemove: boardRemotes.onRemove,
        onUpdate: boardRemotes.onUpdate,
      }
    : storedRemotes;

  return (
    <ManageConnectionsContent remotes={remotes} coordinators={coordinators} />
  );
}
