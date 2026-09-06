/**
 * The overview's control, in the toolbar.
 *
 * It opens the view and, having been used to open a service, is the way back
 * to it. Both belong in one place: the row a facade switches views from is
 * scrolled away or covered by the level an opened service was found on, and a
 * control that moves depending on how the board was left is one that has to be
 * looked for. The toolbar is above both and never moves.
 *
 * There is no hiding to do from here — the view covers the toolbar along with
 * everything else, and closes from its own bar — so this only ever opens.
 *
 * Which service the overview was last used to open is shown rather than said:
 * an icon among icons has no room for a name, so the name goes in the title
 * and the icon marks itself as a way back.
 *
 * A board with nothing on it yet has nothing to look at, and says so by being
 * offered and refused rather than by not being there — a control that comes
 * and goes moves the ones beside it, and is not somewhere to look for next
 * time. The deploy control it stands next to greys out the same way.
 */
import { Boxes } from "lucide-react";

import { useBoardContext } from "hkp-frontend/src/BoardContext";
import { useOverview } from "./OverviewContext";

export default function OverviewToolbarButton() {
  const overview = useOverview();
  const boardContext = useBoardContext();

  const hasServices = Object.values(boardContext?.services ?? {}).some(
    (list) => list.length > 0,
  );

  // Nothing to toggle where no provider is mounted, and nothing to reach for
  // while the view is the thing on screen — it covers this along with the rest
  // of the toolbar, and closes from its own bar.
  if (!overview || overview.visible) {
    return null;
  }

  const disabled = !hasServices;
  const returning = !disabled && overview.revealed !== null;

  return (
    <button
      type="button"
      disabled={disabled}
      title={
        disabled
          ? "Overview — nothing on this board to show yet"
          : returning
            ? `Back to the overview, which opened ${overview.revealed?.label}`
            : "Overview — the whole board, every runtime and nesting level, in one view"
      }
      aria-label={
        returning
          ? `Back to overview, which opened ${overview.revealed?.label}`
          : "Show overview"
      }
      onClick={() => overview.show()}
      style={{
        // The same target the deploy control beside it is, so the two read as
        // one row rather than as a control and a thing next to it.
        position: "relative",
        width: 30,
        height: 30,
        borderRadius: 7,
        border: "none",
        background: "none",
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: returning
          ? "var(--hkp-accent, #0abcfb)"
          : "var(--text, #1a1a1a)",
        opacity: disabled ? 0.4 : 1,
        flexShrink: 0,
      }}
    >
      <Boxes size={16} strokeWidth={1.75} />
      {returning && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "var(--hkp-accent, #0abcfb)",
          }}
        />
      )}
    </button>
  );
}
