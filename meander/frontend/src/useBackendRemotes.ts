import { useCallback, useEffect, useMemo, useState } from "react";

import { RuntimeClass } from "hkp-frontend/src/types";
import type { RemotesController } from "hkp-frontend/src/views/start";

import { deleteRemote, getRemotes, saveRemote } from "./actions";
import { Remote } from "./types";

const toRemote = (desc: RuntimeClass): Remote => ({
  name: desc.name ?? desc.url ?? "",
  url: desc.url ?? "",
  port: 0,
  color: desc.color,
});

/**
 * Remote runtime engines backed by the Meander backend (the persisted remotes
 * in settings.json / the native store) — the source of truth outside a live
 * board context. Satisfies the start page's RemotesController, so it plugs
 * straight into the shared manage-remotes UI.
 */
export function useBackendRemotes(): RemotesController {
  const [remotes, setRemotes] = useState<Remote[]>([]);

  const refresh = useCallback(() => {
    void getRemotes().then(setRemotes);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runtimes = useMemo<RuntimeClass[]>(
    () =>
      remotes.map((r) => ({
        type: "rest",
        name: r.name,
        url: r.url,
        color: r.color,
      })),
    [remotes],
  );

  const onAdd = useCallback(
    (desc: RuntimeClass) => {
      void saveRemote(toRemote(desc)).then(refresh);
    },
    [refresh],
  );

  const onRemove = useCallback(
    (desc: RuntimeClass) => {
      if (desc.name) {
        void deleteRemote(desc.name).then(refresh);
      }
    },
    [refresh],
  );

  const onUpdate = useCallback(
    (desc: RuntimeClass) => {
      void saveRemote(toRemote(desc)).then(refresh);
    },
    [refresh],
  );

  return useMemo(
    () => ({ runtimes, onAdd, onRemove, onUpdate, refresh }),
    [runtimes, onAdd, onRemove, onUpdate, refresh],
  );
}
