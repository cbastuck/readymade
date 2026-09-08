/**
 * The facade board's view controls, in the toolbar.
 *
 * Which half of the board is on screen, and whether the facade editor is open
 * beside it. They sit next to the overview and the deploy control because all
 * of them act on the board as a whole; the facade drew its own bar for them
 * before, which put a second menu bar under the first.
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

  return (
    <>
      {choosable && (
        <div
          role="group"
          aria-label="Board view"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            padding: 2,
            borderRadius: 9,
            border: "1px solid var(--border-mid, #d1d5db)",
            flexShrink: 0,
          }}
        >
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
                  width: 26,
                  height: 24,
                  borderRadius: 7,
                  border: "none",
                  background: active ? "var(--hkp-accent, #0abcfb)" : "none",
                  color: active ? "#fff" : "var(--text, #1a1a1a)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={14} strokeWidth={1.75} />
              </button>
            );
          })}
        </div>
      )}

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
          // The same target the overview and deploy controls beside it are, so
          // the row reads as one.
          width: 30,
          height: 30,
          borderRadius: 7,
          border: "none",
          background: "none",
          cursor: hasBoard ? "pointer" : "default",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color:
            hasBoard && view.editorOpen
              ? "var(--hkp-accent, #0abcfb)"
              : "var(--text, #1a1a1a)",
          opacity: hasBoard ? 1 : 0.4,
          flexShrink: 0,
        }}
      >
        <PencilRuler size={16} strokeWidth={1.75} />
      </button>
    </>
  );
}
