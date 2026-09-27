/**
 * The overview's control, in the toolbar.
 *
 * The board can be looked at two ways — as its runtimes, with their services'
 * panels, or as the overview — and this switches between them. The overview
 * takes the runtimes' place wherever they are shown, so the facade's own view
 * modes carry on working around it: facade alone, facade above the board, or
 * the board alone, whichever way the board is being looked at. Asked for while
 * the facade is all there is, it brings the board back beside the facade,
 * since otherwise nothing would change on screen.
 *
 * Having been used to open a service, it is also the way back to the overview.
 * Both belong in one place: the row a facade switches views from is scrolled
 * away or covered by the level an opened service was found on, and a control
 * that moves depending on how the board was left is one that has to be looked
 * for. The toolbar is above both and never moves.
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
import {
  boardHasFacade,
  useFacadeView,
} from "hkp-frontend/src/facade/FacadeViewContext";
import { useOverview } from "./OverviewContext";

/** How the overview is flown, said where there is room for it. */
const HOW_TO =
  "drag to orbit · shift-drag to pan · wheel to zoom · click to inspect · R to reset";

export default function OverviewToolbarButton() {
  const overview = useOverview();
  const boardContext = useBoardContext();
  const facadeView = useFacadeView();

  const hasServices = Object.values(boardContext?.services ?? {}).some(
    (list) => list.length > 0,
  );

  // Nothing to toggle where no provider is mounted.
  if (!overview) {
    return null;
  }

  const showing = overview.visible;
  const disabled = !hasServices && !showing;
  const returning = !disabled && !showing && overview.revealed !== null;

  const onClick = () => {
    if (showing) {
      overview.hide();
      return;
    }
    if (facadeView?.mode === "facade" && boardHasFacade(boardContext)) {
      facadeView.setMode("split");
    }
    overview.show();
  };

  return (
    <button
      type="button"
      disabled={disabled}
      title={
        disabled
          ? "Overview — nothing on this board to show yet"
          : showing
            ? `Back to the runtimes — the overview is on: ${HOW_TO}`
            : returning
              ? `Back to the overview, which opened ${overview.revealed?.label} — ${HOW_TO}`
              : `Overview — the whole board, every runtime and nesting level, in one view: ${HOW_TO}`
      }
      aria-label={
        showing
          ? "Show the runtimes"
          : returning
            ? `Back to overview, which opened ${overview.revealed?.label}`
            : "Show overview"
      }
      aria-pressed={showing}
      onClick={onClick}
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
        color:
          showing || returning
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
