/**
 * Whether the board is being looked at as its assets.
 *
 * The third way of looking at a board, beside its runtimes and the overview,
 * and like the overview it takes the runtimes' place: the toggle is in the
 * toolbar and the view inside the board, so the state they share lives here.
 * Where no provider is mounted the toggle renders nothing, which is how a host
 * without an asset view opts out.
 *
 * Which asset is open is kept here too, so a service panel can send a person
 * to the asset it names — and which assets a runtime did not take, so that
 * closing the view to look at the board does not lose what is left to retry.
 * Both are of the board that is open, and go when another replaces it.
 */
import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { useBoardContext } from "hkp-frontend/src/BoardContext";

export type AssetViewApi = {
  visible: boolean;
  /** Shows the view, on `assetId` when one is named. */
  show: (assetId?: string) => void;
  hide: () => void;
  selected: string | null;
  select: (assetId: string | null) => void;
  /**
   * The assets whose last change did not reach every runtime using them, by
   * id, with the names of the runtimes still holding the version before.
   */
  staleOn: { [assetId: string]: string[] };
  /** Records the runtimes an asset's last change did not reach; none clears it. */
  setStaleOn: (assetId: string, runtimeNames: string[]) => void;
};

const AssetViewCtx = createContext<AssetViewApi | null>(null);

export function useAssetView(): AssetViewApi | null {
  return useContext(AssetViewCtx);
}

export function AssetViewProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [staleOn, setStale] = useState<{ [assetId: string]: string[] }>({});

  const boardGeneration = useBoardContext()?.boardGeneration;
  const [seenGeneration, setSeenGeneration] = useState(boardGeneration);
  if (seenGeneration !== boardGeneration) {
    setSeenGeneration(boardGeneration);
    setSelected(null);
    setStale({});
  }

  const setStaleOn = useCallback((assetId: string, runtimeNames: string[]) => {
    setStale((previous) => {
      const { [assetId]: _dropped, ...rest } = previous;
      return runtimeNames.length ? { ...rest, [assetId]: runtimeNames } : rest;
    });
  }, []);

  const api = useMemo<AssetViewApi>(
    () => ({
      visible,
      show: (assetId?: string) => {
        if (assetId) {
          setSelected(assetId);
        }
        setVisible(true);
      },
      hide: () => setVisible(false),
      selected,
      select: setSelected,
      staleOn,
      setStaleOn,
    }),
    [visible, selected, staleOn, setStaleOn],
  );

  return <AssetViewCtx.Provider value={api}>{children}</AssetViewCtx.Provider>;
}
