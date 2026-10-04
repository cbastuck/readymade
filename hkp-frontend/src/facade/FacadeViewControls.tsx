/**
 * The facade board's view controls, in the toolbar.
 *
 * Which half of the board is on screen, and whether the facade editor is open
 * beside it. They sit next to the overview and the deploy control because all
 * of them act on the board as a whole; the facade drew its own bar for them
 * before, which put a second menu bar under the first.
 *
 * Two controls, because they are drawn in two groups: the layout is a choice
 * among three and has an outline to itself, while the editor is one of the
 * things shown beside or in place of the board and shares its outline with
 * the overview and the assets.
 *
 * A board with no facade has nothing to choose between, so the layout control
 * is not there at all — a board without one is where a facade is started, not
 * where one is switched away from. The editor stays, because starting one is
 * what it is for.
 *
 * A board with no runtimes yet is not on screen at all: the playground shows a
 * place to start one instead, and neither control has anything to act on. The
 * editor is refused rather than removed, so the way to a facade is where it
 * will be once there is a board to put one on.
 */
import { AppWindow, PencilRuler, Rows2, Workflow } from "lucide-react";

import { useBoardContext } from "hkp-frontend/src/BoardContext";
import ToolbarGroup, {
  TOOLBAR_GROUP_BUTTON,
  TOOLBAR_GROUP_ICON_SIZE,
} from "hkp-frontend/src/components/Toolbar/ToolbarGroup";
import {
  boardHasFacade,
  boardHasRuntimes,
  FacadeViewMode,
  useFacadeView,
} from "./FacadeViewContext";

const MODES: Array<{
  id: FacadeViewMode;
  Icon: typeof AppWindow;
  title: string;
  label: string;
}> = [
  {
    id: "facade",
    Icon: AppWindow,
    title: "Facade only",
    label: "Show the facade only",
  },
  {
    id: "split",
    Icon: Rows2,
    title: "Facade above the board",
    label: "Show the facade and the board",
  },
  {
    id: "board",
    Icon: Workflow,
    title: "Board only — the runtimes and their services",
    label: "Show the board only",
  },
];

export default function FacadeViewControls() {
  const view = useFacadeView();
  const boardContext = useBoardContext();

  if (!view) {
    return null;
  }

  const hasBoard = boardHasRuntimes(boardContext);

  // While the editor is open there is a facade being built even where the
  // board declares none, and something has to say whether it or the board is
  // the thing on screen.
  const choosable =
    hasBoard && (boardHasFacade(boardContext) || view.editorOpen);

  if (!choosable) {
    return null;
  }

  return (
    <ToolbarGroup label="Board view">
      {MODES.map(({ id, Icon, title, label }) => {
        const active = view.mode === id;
        return (
          <button
            key={id}
            type="button"
            title={title}
            aria-label={label}
            aria-pressed={active}
            onClick={() => view.setMode(id)}
            style={{
              ...TOOLBAR_GROUP_BUTTON,
              background: active ? "var(--hkp-accent, #0abcfb)" : "none",
              color: active ? "#fff" : "var(--text, #1a1a1a)",
              cursor: "pointer",
            }}
          >
            <Icon size={TOOLBAR_GROUP_ICON_SIZE} strokeWidth={1.75} />
          </button>
        );
      })}
    </ToolbarGroup>
  );
}

/** Opens and closes the facade editor; one of the board's view toggles. */
export function FacadeEditorButton() {
  const view = useFacadeView();
  const boardContext = useBoardContext();

  if (!view) {
    return null;
  }

  const hasBoard = boardHasRuntimes(boardContext);

  return (
    <button
      type="button"
      disabled={!hasBoard}
      title={
        hasBoard
          ? "Facade editor — lay out this board's facade"
          : "Facade editor — add a runtime first"
      }
      aria-label="Toggle the facade editor"
      aria-pressed={hasBoard && view.editorOpen}
      onClick={view.toggleEditor}
      style={{
        ...TOOLBAR_GROUP_BUTTON,
        background: "none",
        cursor: hasBoard ? "pointer" : "default",
        color:
          hasBoard && view.editorOpen
            ? "var(--hkp-accent, #0abcfb)"
            : "var(--text, #1a1a1a)",
        opacity: hasBoard ? 1 : 0.4,
      }}
    >
      <PencilRuler size={TOOLBAR_GROUP_ICON_SIZE} strokeWidth={1.75} />
    </button>
  );
}
