import { createContext, useContext } from "react";

import { useBoardContext } from "hkp-frontend/src/BoardContext";
import { storeAvailableRuntimeEngines } from "hkp-frontend/src/common";
import { RuntimeClass } from "hkp-frontend/src/types";

/**
 * Where a host keeps the remote runtimes the user registers. Without one they
 * live in localStorage; a host with its own store (Readymade's settings) gets
 * each change as it happens, so an edit made on a board outlives a restart.
 */
export type RemoteRuntimeStore = {
  onAdd: (rt: RuntimeClass) => void;
  onRemove: (rt: RuntimeClass) => void;
  onUpdate: (rt: RuntimeClass) => void;
};

export const RemoteRuntimeStoreCtx = createContext<RemoteRuntimeStore | null>(
  null,
);

/**
 * Add, remove and update remote runtimes on the current board's engine pool,
 * persisting each change to the host's store, or to localStorage without one.
 */
export function useRemoteRuntimeEditing(): RemoteRuntimeStore {
  const boardContext = useBoardContext();
  const store = useContext(RemoteRuntimeStoreCtx);

  // Without a host store the whole pool is written back, as the web has
  // always kept it; a host store is told only what changed.
  const persist = (engines: RuntimeClass[], toStore?: () => void) => {
    if (toStore) {
      toStore();
    } else {
      storeAvailableRuntimeEngines(engines);
    }
  };

  return {
    onAdd: (rt) =>
      persist(
        boardContext?.addAvailableRuntime(rt, false) ?? [],
        store ? () => store.onAdd(rt) : undefined,
      ),
    onRemove: (rt) =>
      persist(
        boardContext?.removeAvailableRuntime(rt) ?? [],
        store ? () => store.onRemove(rt) : undefined,
      ),
    onUpdate: (rt) =>
      persist(
        boardContext?.addAvailableRuntime(rt, true) ?? [],
        store ? () => store.onUpdate(rt) : undefined,
      ),
  };
}
