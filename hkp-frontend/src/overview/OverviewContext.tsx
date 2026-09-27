/**
 * Whether the board is being looked at as the overview rather than as its
 * runtimes, and what the overview was last used to reach.
 *
 * The toggle and the view itself sit in different parts of the tree — the
 * button is in the toolbar, above the board, while the view takes the board's
 * place inside it. The state they share lives here so neither
 * has to know where the other is, and the button renders nothing at all where
 * no provider is mounted, which is how hosts that have no overview opt out.
 *
 * The service the overview was last used to open is remembered too, because
 * arriving at one is half a round trip. The switch that led there is by then
 * wherever the board scrolled away to, or behind a level that opening the
 * service pushed on top of it, so the way back has to be somewhere that does
 * not move.
 *
 * How the overview lays the board out is chosen in the toolbar too, and kept
 * per viewer: it is a way of looking, not something about the board.
 */
import { createContext, useContext, useMemo, useState } from "react";

import { OverviewLayout } from "./graph";

const LAYOUT_KEY = "hkp-overview-layout";

/**
 * The layout this viewer last chose. Read defensively: storage can be
 * unavailable, and then the overview simply opens side by side.
 */
function readLayout(): OverviewLayout {
  try {
    return window.localStorage.getItem(LAYOUT_KEY) === "stacked"
      ? "stacked"
      : "lanes";
  } catch {
    return "lanes";
  }
}

function writeLayout(layout: OverviewLayout) {
  try {
    window.localStorage.setItem(LAYOUT_KEY, layout);
  } catch {
    // Not remembered, which costs one click next time.
  }
}

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
  layout: OverviewLayout;
  setLayout: (layout: OverviewLayout) => void;
};

const OverviewCtx = createContext<OverviewApi | null>(null);

export function useOverview(): OverviewApi | null {
  return useContext(OverviewCtx);
}

export function OverviewProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [revealed, setRevealed] = useState<RevealedService | null>(null);
  const [layout, setLayoutState] = useState<OverviewLayout>(readLayout);

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
      layout,
      setLayout: (next: OverviewLayout) => {
        setLayoutState(next);
        writeLayout(next);
      },
    }),
    [visible, revealed, layout],
  );

  return <OverviewCtx.Provider value={api}>{children}</OverviewCtx.Provider>;
}
