/**
 * The toolbar's play controls: start the board, with or without an input.
 *
 * A runtime's header already runs that runtime, and that is where a board is
 * built from — one runtime at a time, watching what each does. This is for the
 * board as a whole, which is a different thing to want and lives at a
 * different level: what a person does once the board is built is run it and
 * watch, and the runtime that happens to be first is a detail of the board
 * rather than something to go and find a header for.
 *
 * Two presses rather than one with a key held, grouped the way the view
 * controls are: running a board and writing what to run it with are the two
 * things done with a finished board, and a gesture that has to be explained is
 * worse than a second button that shows itself. What was written last time is
 * what the plain press sends, from here or from the overview, which offers the
 * same control over the same memory: an input is written once and wanted many
 * times.
 */
import { useContext, useState } from "react";
import { Play, SlidersHorizontal } from "lucide-react";

import { BoardCtx } from "hkp-frontend/src/BoardContext";
import { canPlay, play, useRunParams } from "hkp-frontend/src/core/play";
import RunParamsDialog from "hkp-frontend/src/ui-components/runtime-ui/RunParamsDialog";

/** The same target the view controls beside them are, so the two groups read
 *  as one row of things done to the board. */
function controlStyle(enabled: boolean, lit: boolean): React.CSSProperties {
  return {
    width: 26,
    height: 24,
    borderRadius: 7,
    border: "none",
    background: "none",
    cursor: enabled ? "pointer" : "default",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: lit ? "var(--hkp-accent, #0abcfb)" : "var(--text, #1a1a1a)",
    opacity: enabled ? 1 : 0.4,
    flexShrink: 0,
  };
}

export default function PlayBoardControls() {
  const boardContext = useContext(BoardCtx);
  const [asking, setAsking] = useState(false);
  const [lastParams, setLastParams] = useRunParams();

  const playable = !!boardContext && canPlay(boardContext);
  const armed = playable && lastParams !== undefined;

  return (
    <>
      <div
        role="group"
        aria-label="Run controls"
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
        <button
          type="button"
          disabled={!playable}
          title={
            !playable
              ? "Nothing on this board to run yet"
              : armed
                ? "Run the board again with what it was last given"
                : "Run the board from the top"
          }
          aria-label={armed ? "Run the board again" : "Run the board"}
          onClick={() => {
            if (boardContext) {
              play(boardContext, lastParams);
            }
          }}
          // Carrying an input marks itself, the way the overview's control
          // marks a way back: the press does more than the plain one does,
          // and an icon has no room to say what.
          style={controlStyle(playable, armed)}
        >
          <Play size={14} strokeWidth={1.75} />
        </button>

        <button
          type="button"
          disabled={!playable}
          title={
            !playable
              ? "Nothing on this board to run yet"
              : "Run the board with an input written by hand"
          }
          aria-label="Run the board with parameters"
          onClick={() => setAsking(true)}
          style={controlStyle(playable, false)}
        >
          <SlidersHorizontal size={14} strokeWidth={1.75} />
        </button>
      </div>

      <RunParamsDialog
        open={asking}
        onClose={() => setAsking(false)}
        onRun={(params) => {
          setAsking(false);
          setLastParams(params);
          if (boardContext) {
            play(boardContext, params);
          }
        }}
        target="the first service of the first runtime"
      />
    </>
  );
}
