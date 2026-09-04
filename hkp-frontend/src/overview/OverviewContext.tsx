/**
 * Whether the overview is being looked at, and what it was last used to reach.
 *
 * The toggle and the view itself sit in different parts of the tree — the
 * button is in the toolbar, above the board, while the view covers the window
 * and is mounted once near the top. The state they share lives here so neither
 * has to know where the other is, and the button renders nothing at all where
 * no provider is mounted, which is how hosts that have no overview opt out.
 *
 * The service the overview was last used to open is remembered too, because
 * arriving at one is half a round trip. The switch that led there is by then
 * wherever the board scrolled away to, or behind a level that opening the
 * service pushed on top of it, so the way back has to be somewhere that does
 * not move.
 */
import { createContext, useContext, useMemo, useState } from "react";

/** A service the overview was used to open, named so the way back can say so. */
export type RevealedService = { uuid: string; label: string };

export type OverviewApi = {
  visible: boolean;
  show: () => void;
  hide: () => void;
  toggle: () => void;
  /** What the overview was last used to open, until it is opened again. */
  revealed: RevealedService | null;
  setRevealed: (service: RevealedService | null) => void;
};

const OverviewCtx = createContext<OverviewApi | null>(null);

export function useOverview(): OverviewApi | null {
  return useContext(OverviewCtx);
}

export function OverviewProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [revealed, setRevealed] = useState<RevealedService | null>(null);

  const api = useMemo<OverviewApi>(
    () => ({
      visible,
      // Coming back closes the trip that led away: the overview is on screen
      // again, so there is no longer a service it is standing behind.
      show: () => {
        setRevealed(null);
        setVisible(true);
      },
      hide: () => setVisible(false),
      toggle: () =>
        setVisible((v) => {
          if (!v) {
            setRevealed(null);
          }
          return !v;
        }),
      revealed,
      setRevealed,
    }),
    [visible, revealed],
  );

  return <OverviewCtx.Provider value={api}>{children}</OverviewCtx.Provider>;
}
