/**
 * The asset view's control, in the toolbar, beside the overview's.
 *
 * The view takes the runtimes' place the way the overview does, so the two are
 * alternatives: showing one hides the other. Asked for while the facade is all
 * there is, it brings the board back beside the facade, since otherwise
 * nothing would change on screen.
 *
 * Offered and refused on a board with no runtimes, rather than hidden, so the
 * row it sits in does not move.
 */
import { FileCode2 } from "lucide-react";

import { useBoardContext } from "hkp-frontend/src/BoardContext";
import {
  boardHasFacade,
  useFacadeView,
} from "hkp-frontend/src/facade/FacadeViewContext";
import {
  TOOLBAR_GROUP_BUTTON,
  TOOLBAR_GROUP_ICON_SIZE,
} from "hkp-frontend/src/components/Toolbar/ToolbarGroup";
import { useOverview } from "hkp-frontend/src/overview/OverviewContext";
import { useAssetView } from "./AssetViewContext";

export default function AssetViewToolbarButton() {
  const assetView = useAssetView();
  const overview = useOverview();
  const boardContext = useBoardContext();
  const facadeView = useFacadeView();

  if (!assetView) {
    return null;
  }

  const count = boardContext?.assets?.length ?? 0;
  const showing = assetView.visible && !overview?.visible;
  const disabled = !boardContext?.runtimes.length && !showing;

  const onClick = () => {
    if (showing) {
      assetView.hide();
      return;
    }
    overview?.hide();
    if (facadeView?.mode === "facade" && boardHasFacade(boardContext)) {
      facadeView.setMode("split");
    }
    assetView.show();
  };

  return (
    <button
      type="button"
      disabled={disabled}
      title={
        disabled
          ? "Assets — nothing on this board yet"
          : showing
            ? "Back to the runtimes"
            : `Assets — content this board declares once and its services name by reference (${count})`
      }
      aria-label={showing ? "Show the runtimes" : "Show assets"}
      aria-pressed={showing}
      onClick={onClick}
      style={{
        ...TOOLBAR_GROUP_BUTTON,
        background: "none",
        cursor: disabled ? "default" : "pointer",
        color: showing ? "var(--hkp-accent, #0abcfb)" : "var(--text, #1a1a1a)",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <FileCode2 size={TOOLBAR_GROUP_ICON_SIZE} strokeWidth={1.75} />
    </button>
  );
}
