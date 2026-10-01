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
 * to the asset it names.
 */
import { createContext, useContext, useMemo, useState } from "react";

export type AssetViewApi = {
  visible: boolean;
  /** Shows the view, on `assetId` when one is named. */
  show: (assetId?: string) => void;
  hide: () => void;
  selected: string | null;
  select: (assetId: string | null) => void;
};

const AssetViewCtx = createContext<AssetViewApi | null>(null);

export function useAssetView(): AssetViewApi | null {
  return useContext(AssetViewCtx);
}

export function AssetViewProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

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
    }),
    [visible, selected],
  );

  return <AssetViewCtx.Provider value={api}>{children}</AssetViewCtx.Provider>;
}
