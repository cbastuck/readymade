import { KeyRound, Network } from "lucide-react";

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
import SecretsTab from "./settings/SecretsTab";
import { SettingsNote } from "./settings/kit";
import { sessionSecrets } from "hkp-frontend/src/secretsBackend";
import { pushSecretToBoard } from "hkp-frontend/src/runtime/rest/pushSecretToBoard";

export const CONNECTIONS_TAB = "connections";
export const SECRETS_TAB = "secrets";

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
 * Appearance, the servers this browser knows, the secrets this page holds, and
 * the licences of the bundle it was served — no native code, so a shorter list
 * than any of the apps.
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
        {
          id: SECRETS_TAB,
          label: "Secrets",
          icon: <KeyRound size={15} />,
          content: <SessionSecrets />,
        },
        licencesTab("website"),
      ]}
    />
  );
}

const sessionSecretsBackend = async () => sessionSecrets;

function SessionSecrets() {
  const boardContext = useBoardContext();
  return (
    <SecretsTab
      getBackend={sessionSecretsBackend}
      onSaved={(alias) => void pushSecretToBoard(boardContext, alias)}
      note={
        <SettingsNote tone="warn">
          Kept in this page&rsquo;s memory only: closing or reloading the tab
          forgets them. Nothing is written to the browser or sent to a server
          until a board you allow hands one to its runtime.
        </SettingsNote>
      }
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
