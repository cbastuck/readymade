/**
 * Whether the overview is being looked at.
 *
 * The toggle and the view itself sit in different parts of the tree — the
 * button belongs next to the other view switches, which differ between a board
 * with a facade and one without, while the view covers the window and is
 * mounted once near the top. The state they share lives here so neither has to
 * know where the other is, and the button renders nothing at all where no
 * provider is mounted, which is how hosts that have no overview opt out.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type OverviewApi = {
  visible: boolean;
  show: () => void;
  hide: () => void;
  toggle: () => void;
};

const OverviewCtx = createContext<OverviewApi | null>(null);

export function useOverview(): OverviewApi | null {
  return useContext(OverviewCtx);
}

export function OverviewProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  const api = useMemo<OverviewApi>(
    () => ({
      visible,
      show: () => setVisible(true),
      hide: () => setVisible(false),
      toggle: () => setVisible((v) => !v),
    }),
    [visible],
  );

  return <OverviewCtx.Provider value={api}>{children}</OverviewCtx.Provider>;
}

/**
 * The switch, in the same shape as the facade and board switches it stands
 * beside.
 */
export function OverviewToggleButton({
  style,
}: {
  style?: React.CSSProperties;
}) {
  const overview = useOverview();
  const onClick = useCallback(() => overview?.toggle(), [overview]);

  if (!overview) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      title="Look at the whole board — every runtime, every nesting level — in one view"
      style={{
        padding: "4px 10px",
        borderRadius: 6,
        border: "1px solid hsl(var(--border))",
        background: overview.visible ? "hsl(var(--accent))" : "transparent",
        color: overview.visible
          ? "hsl(var(--accent-foreground))"
          : "hsl(var(--muted-foreground))",
        cursor: "pointer",
        fontSize: 11,
        fontFamily: "monospace",
        ...style,
      }}
    >
      {overview.visible ? "{ hide overview }" : "{ show overview }"}
    </button>
  );
}
