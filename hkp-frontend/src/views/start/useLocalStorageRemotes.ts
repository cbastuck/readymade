import { useState } from "react";

import {
  restoreAvailableRuntimeEngines,
  storeAvailableRuntimeEngines,
} from "../../common";
import { RuntimeClass } from "../../types";
import { RemotesController } from "./types";

const sameRuntime = (a: RuntimeClass, b: RuntimeClass) =>
  a.name === b.name && a.url === b.url;

/**
 * A RemotesController over the stored remote runtimes — the localStorage entry
 * a board reads its available engines from when its host passes none, so a
 * remote managed through this controller is there on the next board session.
 */
export function useLocalStorageRemotes(): RemotesController {
  const [remoteRuntimes, setRemoteRuntimes] = useState<RuntimeClass[]>(
    restoreAvailableRuntimeEngines,
  );
  const mutateRemotes = (next: RuntimeClass[]) => {
    storeAvailableRuntimeEngines(next);
    setRemoteRuntimes(next);
  };
  return {
    runtimes: remoteRuntimes,
    onAdd: (rt) => mutateRemotes([...remoteRuntimes, rt]),
    onRemove: (rt) =>
      mutateRemotes(remoteRuntimes.filter((e) => !sameRuntime(e, rt))),
    onUpdate: (previous, next) =>
      mutateRemotes(
        remoteRuntimes.map((e) => (sameRuntime(e, previous) ? next : e)),
      ),
    refresh: () => setRemoteRuntimes(restoreAvailableRuntimeEngines()),
  };
}
