import { useBoardContext } from "hkp-frontend/src/BoardContext";
import { pushSecretToBoard } from "hkp-frontend/src/runtime/rest/pushSecretToBoard";
import { SettingsNote } from "hkp-frontend/src/ui-components/settings/kit";
import SharedSecretsTab from "hkp-frontend/src/ui-components/settings/SecretsTab";

import { getBackend } from "./backend";

/** The Secrets tab over the desktop app's vault (`meander/backend/vault.h`). */
export default function SecretsTab() {
  const boardContext = useBoardContext();
  return (
    <SharedSecretsTab
      getBackend={getBackend}
      onSaved={(alias) => void pushSecretToBoard(boardContext, alias)}
      note={
        <SettingsNote tone="warn">
          Stored in ~/.hkp/vault.json, readable only by your user account. The
          file is not encrypted — anything that can run as you can read it. What
          you have allowed is in ~/.hkp/grants.json alongside it.
        </SettingsNote>
      }
    />
  );
}
