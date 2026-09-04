/**
 * The facade board's view controls, in the toolbar.
 *
 * Which half of the board is on screen, and whether the facade editor is open
 * beside it. They sit next to the overview and the deploy control because all
 * of them act on the board as a whole; the facade drew its own bar for them
 * before, which put a second menu bar under the first.
 *
 * A board with no facade is offered them and refused rather than not shown
 * them, so the controls beside them keep their place, and so the same board
 * with a facade added has them where they were.
 */
import { AppWindow, PencilRuler, Rows2, Workflow } from "lucide-react";

import { useBoardContext } from "hkp-frontend/src/BoardContext";
import {
  boardHasFacade,
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

  const disabled = !boardHasFacade(boardContext);

  return (
    <>
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
          opacity: disabled ? 0.4 : 1,
          flexShrink: 0,
        }}
      >
        {MODES.map(({ id, Icon, title, label }) => {
          const active = !disabled && view.mode === id;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
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
                cursor: disabled ? "default" : "pointer",
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

      <button
        type="button"
        disabled={disabled}
        title="Facade editor — lay out this board's facade"
        aria-label="Toggle the facade editor"
        aria-pressed={!disabled && view.editorOpen}
        onClick={view.toggleEditor}
        style={{
          // The same target the overview and deploy controls beside it are, so
          // the row reads as one.
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
            !disabled && view.editorOpen
              ? "var(--hkp-accent, #0abcfb)"
              : "var(--text, #1a1a1a)",
          opacity: disabled ? 0.4 : 1,
          flexShrink: 0,
        }}
      >
        <PencilRuler size={16} strokeWidth={1.75} />
      </button>
    </>
  );
}
