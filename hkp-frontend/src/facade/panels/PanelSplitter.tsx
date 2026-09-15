import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The width a facade's columns are left at.
 *
 * A facade laid out in columns divides them evenly, which is a guess: the
 * panels hold different things, and which of them deserves the room is the
 * reader's business rather than the board's. So the divider between two
 * columns is draggable, and what it takes from one it gives to the other —
 * the same arrangement the playground's sidebar uses between its runtimes and
 * its services.
 *
 * Widths are kept as **flex weights rather than pixels**, so a window that is
 * resized keeps the proportion a person chose instead of leaving one column at
 * a fixed size while the other absorbs everything. They are remembered per
 * board, because the answer is about a particular facade's columns and not a
 * preference that should follow someone to the next board.
 */

/** Enough of a column to be worth having; below this the drag stops. */
const MIN_PANEL_WIDTH = 160;

/** How far one arrow-key press moves the divider. */
const KEY_STEP = 16;

const storageKey = (boardName: string) =>
  `hkp-facade-panel-widths-${boardName}`;

/**
 * The remembered weights, or null for "divide evenly".
 *
 * A stored list that does not match the number of columns is discarded: the
 * facade has been edited since, and stretching an old answer over a new set of
 * panels would size them by a coincidence of ordering.
 */
function readWeights(boardName: string, count: number): number[] | null {
  try {
    const stored = localStorage.getItem(storageKey(boardName));
    if (!stored) {
      return null;
    }
    const parsed = JSON.parse(stored);
    if (
      !Array.isArray(parsed) ||
      parsed.length !== count ||
      !parsed.every((n) => typeof n === "number" && Number.isFinite(n) && n > 0)
    ) {
      return null;
    }
    return parsed as number[];
  } catch {
    // A private window, or a value written by something else. Even columns are
    // a perfectly good answer, so there is nothing to report.
    return null;
  }
}

export type PanelWidths = {
  /** The flex weight for a column, by index. */
  weightOf: (index: number) => number;
  /** All weights, as the splitter's arithmetic needs them. */
  weights: () => number[];
  /** null divides the columns evenly again. */
  setWeights: (next: number[] | null) => void;
  /** Writes what is on screen down, at the end of a drag. */
  commit: () => void;
  /** Back to even columns, forgetting what was stored. */
  reset: () => void;
};

export function usePanelWidths(boardName: string, count: number): PanelWidths {
  const [weights, setWeightsState] = useState<number[] | null>(() =>
    readWeights(boardName, count),
  );

  /**
   * The weights as last *set*, rather than as last rendered.
   *
   * A drag's listeners are registered once, at the start of the drag, so they
   * cannot close over the current state. The ref is written by the setter and
   * not during render, because a commit can follow a set within the same tick
   * — the end of a drag does exactly that — and a render-time assignment would
   * still be showing the value before it.
   */
  const ref = useRef(weights);

  const setWeights = useCallback((next: number[] | null) => {
    ref.current = next;
    setWeightsState(next);
  }, []);

  // A different board, or a facade whose panels changed, starts again from
  // whatever that board was left at.
  useEffect(() => {
    setWeights(readWeights(boardName, count));
  }, [boardName, count, setWeights]);

  return {
    weightOf: (index) => weights?.[index] ?? 1,
    weights: () => ref.current ?? Array.from({ length: count }, () => 1),
    setWeights,
    commit: () => {
      const value = ref.current;
      if (!value) {
        return;
      }
      try {
        localStorage.setItem(storageKey(boardName), JSON.stringify(value));
      } catch {
        // Not being able to remember the width is not a reason to refuse to
        // change it.
      }
    },
    reset: () => {
      setWeights(null);
      try {
        localStorage.removeItem(storageKey(boardName));
      } catch {
        // As above.
      }
    },
  };
}

/**
 * The divider between two columns.
 *
 * It moves width from one neighbour to the other and leaves every other column
 * alone, so dragging one divider on a three-column facade does not shuffle the
 * third. The pair's share of the whole is what is conserved: their weights are
 * re-split in the proportion the pointer implies.
 */
export function PanelSplitter({
  index,
  widths,
  widthsOf,
  label,
}: {
  /** The divider sits between column `index` and column `index + 1`. */
  index: number;
  widths: PanelWidths;
  /** The columns' widths on screen, in pixels, measured when a drag starts. */
  widthsOf: () => number[];
  /** What the two columns are called, for the handle's accessible name. */
  label: string;
}) {
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);

  // While dragging, the whole document shows the resize cursor and stops
  // selecting text — the pointer regularly leaves the handle itself.
  useEffect(() => {
    if (!dragging) {
      return;
    }
    const { style } = document.body;
    const cursor = style.cursor;
    const select = style.userSelect;
    style.cursor = "ew-resize";
    style.userSelect = "none";
    return () => {
      style.cursor = cursor;
      style.userSelect = select;
    };
  }, [dragging]);

  /**
   * The weights the pair should have once the divider has moved `delta`
   * pixels, or null while there is nothing to divide.
   */
  const moved = (
    startPx: number[],
    startWeights: number[],
    delta: number,
  ): number[] | null => {
    const left = startPx[index];
    const right = startPx[index + 1];
    const room = left + right;
    // Before the first layout there is nothing on screen to take width from.
    if (!(room > 0)) {
      return null;
    }
    // Neither neighbour is dragged away entirely; past the end the divider
    // simply stops.
    const bounded = Math.max(
      MIN_PANEL_WIDTH - left,
      Math.min(right - MIN_PANEL_WIDTH, delta),
    );
    const share = startWeights[index] + startWeights[index + 1];
    const next = [...startWeights];
    next[index] = (share * (left + bounded)) / room;
    next[index + 1] = (share * (right - bounded)) / room;
    return next;
  };

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startPx = widthsOf();
    const startWeights = widths.weights();
    setDragging(true);

    const move = (e: PointerEvent) => {
      const next = moved(startPx, startWeights, e.clientX - startX);
      if (next) {
        widths.setWeights(next);
      }
    };
    const stop = () => {
      setDragging(false);
      widths.commit();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowLeft"
        ? -KEY_STEP
        : event.key === "ArrowRight"
          ? KEY_STEP
          : 0;
    if (!step) {
      return;
    }
    event.preventDefault();
    const next = moved(widthsOf(), widths.weights(), step);
    if (next) {
      widths.setWeights(next);
      widths.commit();
    }
  };

  const lit = dragging || hovered;
  const hairline = lit ? "var(--hkp-accent)" : "hsl(var(--border))";
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label}`}
      tabIndex={0}
      onPointerDown={startDrag}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onDoubleClick={widths.reset}
      onKeyDown={onKeyDown}
      title="Drag to resize — double-click to even them up"
      style={{
        width: 7,
        flexShrink: 0,
        alignSelf: "stretch",
        cursor: "ew-resize",
        userSelect: "none",
        // The hairline lights up on hover and while dragging; the hit area
        // around it stays invisible, so the divider is easy to grab without
        // looking like a gutter.
        background: `linear-gradient(90deg, transparent 3px, ${hairline} 3px, ${hairline} 4px, transparent 4px)`,
      }}
    />
  );
}
