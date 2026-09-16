import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import {
  PanelSplitter,
  panelShare,
  usePanelWidths,
} from "../panels/PanelSplitter";

/**
 * Dragging the divider between two facade columns.
 *
 * The arithmetic is what this pins, because it is the part that is not
 * obvious: the divider moves width from one neighbour to the other, and what
 * is conserved is *the pair's share of the whole*. That is what lets a facade
 * with three columns have two dividers that do not interfere — dragging one
 * must leave the third column exactly where it was.
 *
 * Widths are weights rather than pixels, so the assertions are about ratios.
 */

/** A splitter over columns of the given pixel widths, reporting its weights. */
function splitterOver(pixels: number[], count = pixels.length) {
  let weights: number[] = Array.from({ length: count }, () => 1);
  const stub = {
    weightOf: (i: number) => weights[i],
    weights: () => weights,
    setWeights: (next: number[]) => {
      weights = next;
    },
    commit: () => {},
    reset: () => {
      weights = Array.from({ length: count }, () => 1);
    },
  };
  const view = render(
    <PanelSplitter
      index={0}
      widths={stub}
      widthsOf={() => pixels}
      label="left and right"
    />,
  );
  return { view, handle: screen.getByRole("separator"), at: () => weights };
}

/** The columns' widths implied by the weights, over the same total. */
function pixelsFrom(weights: number[], total: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => Math.round((w / sum) * total));
}

/**
 * A pointer event carrying a position.
 *
 * jsdom implements no PointerEvent, so fireEvent's own pointer helpers fall
 * back to a plain Event and drop `clientX` — which is the only thing a drag
 * reads. A MouseEvent under the pointer event's name carries it, and React
 * dispatches on the name.
 */
function pointer(type: string, clientX: number) {
  return new MouseEvent(type, { clientX, bubbles: true });
}

function drag(handle: HTMLElement, from: number, to: number) {
  fireEvent(handle, pointer("pointerdown", from));
  fireEvent(window, pointer("pointermove", to));
  fireEvent(window, pointer("pointerup", to));
}

describe("the facade column splitter", () => {
  it("gives the dragged-over width to one column and takes it from the other", () => {
    const { handle, at } = splitterOver([400, 400]);

    drag(handle, 400, 500);

    // 100px moved across: 500 / 300 of an 800px pair.
    expect(pixelsFrom(at(), 800)).toEqual([500, 300]);
  });

  it("leaves a third column exactly where it was", () => {
    const { handle, at } = splitterOver([300, 300, 300]);

    drag(handle, 300, 380);

    const widths = pixelsFrom(at(), 900);
    expect(widths).toEqual([380, 220, 300]);
    // The pair's share of the whole is what is conserved, so the untouched
    // column keeps its weight and not merely its ratio to one neighbour.
    expect(at()[2]).toBe(1);
  });

  it("stops rather than dragging a column away entirely", () => {
    const { handle, at } = splitterOver([400, 400]);

    // Far past the right-hand column's minimum.
    drag(handle, 400, 2000);

    const [left, right] = pixelsFrom(at(), 800);
    expect(right).toBe(160);
    expect(left).toBe(640);
  });

  it("stops at the near end too", () => {
    const { handle, at } = splitterOver([400, 400]);

    drag(handle, 400, -2000);

    expect(pixelsFrom(at(), 800)).toEqual([160, 640]);
  });

  it("evens the columns up again on a double-click", () => {
    const { handle, at } = splitterOver([400, 400]);

    drag(handle, 400, 600);
    expect(pixelsFrom(at(), 800)).not.toEqual([400, 400]);

    fireEvent.dblClick(handle);
    expect(pixelsFrom(at(), 800)).toEqual([400, 400]);
  });

  it("moves on the arrow keys, for a divider nobody can drag", () => {
    const { handle, at } = splitterOver([400, 400]);

    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(pixelsFrom(at(), 800)).toEqual([416, 384]);
  });

  it("does nothing before the columns have been laid out", () => {
    // Measured at zero, there is no width to take from either side.
    const { handle, at } = splitterOver([0, 0]);

    drag(handle, 0, 120);

    expect(at()).toEqual([1, 1]);
  });
});

// ── What gets remembered ────────────────────────────────────────────────────

/** Renders the hook's answer for a board, as text. */
function Widths({
  board,
  count,
  shares,
}: {
  board: string;
  count: number;
  shares?: (number | undefined)[];
}) {
  const widths = usePanelWidths(board, count, shares);
  return (
    <button
      onClick={() => {
        widths.setWeights([3, 1]);
        widths.commit();
      }}
      onDoubleClick={widths.reset}
    >
      {Array.from({ length: count }, (_, i) => widths.weightOf(i)).join(",")}
    </button>
  );
}

/** A mounted hook, scoped to its own render so two can be compared. */
function widthsFor(
  board: string,
  count: number,
  shares?: (number | undefined)[],
) {
  const view = render(<Widths board={board} count={count} shares={shares} />);
  const button = view.getByRole("button");
  return {
    shown: () => button.textContent,
    choose: () => fireEvent.click(button),
    putBack: () => fireEvent.dblClick(button),
    unmount: view.unmount,
  };
}

describe("remembered column widths", () => {
  beforeEach(() => localStorage.clear());

  it("divides evenly until someone says otherwise", () => {
    expect(widthsFor("Reader", 2).shown()).toBe("1,1");
  });

  it("remembers what a board's columns were left at", () => {
    const first = widthsFor("Reader", 2);
    first.choose();
    expect(first.shown()).toBe("3,1");
    first.unmount();

    const again = widthsFor("Reader", 2);
    expect(again.shown()).toBe("3,1");
    again.unmount();
  });

  it("keeps one board's columns to that board", () => {
    const reader = widthsFor("Reader", 2);
    reader.choose();
    reader.unmount();

    // Another board's facade is another set of columns.
    const other = widthsFor("Other", 2);
    expect(other.shown()).toBe("1,1");
    other.unmount();
  });

  it("discards a remembered answer the facade has outgrown", () => {
    const two = widthsFor("Reader", 2);
    two.choose();
    two.unmount();

    // A third panel has been added since: stretching two widths over three
    // columns would size them by a coincidence of ordering.
    const three = widthsFor("Reader", 3);
    expect(three.shown()).toBe("1,1,1");
    three.unmount();
  });
});

// ── What the board asked for ────────────────────────────────────────────────

describe("declared column shares", () => {
  beforeEach(() => localStorage.clear());

  it("reads a share off a percentage or a bare number, and ignores nonsense", () => {
    expect(panelShare("70%")).toBe(70);
    expect(panelShare(30)).toBe(30);
    expect(panelShare(undefined)).toBeUndefined();
    expect(panelShare("auto")).toBeUndefined();
    // A column of no width is not a column; an even split says more.
    expect(panelShare(0)).toBeUndefined();
    expect(panelShare("-20%")).toBeUndefined();
  });

  it("opens at the split the board declared", () => {
    const reader = widthsFor("Reader", 2, [70, 30]);
    expect(reader.shown()).toBe("70,30");
    reader.unmount();
  });

  it("gives a panel with no opinion an average share, not a sliver", () => {
    // Relative weights: 1 beside 70 would read as a mistake in the board.
    const reader = widthsFor("Reader", 3, [70, undefined, 30]);
    expect(reader.shown()).toBe("70,50,30");
    reader.unmount();
  });

  it("lets the reader overrule the board, and remembers that instead", () => {
    const reader = widthsFor("Reader", 2, [70, 30]);
    reader.choose();
    expect(reader.shown()).toBe("3,1");
    reader.unmount();

    const again = widthsFor("Reader", 2, [70, 30]);
    expect(again.shown()).toBe("3,1");
    again.unmount();
  });

  it("puts the board's own split back on a double-click", () => {
    const reader = widthsFor("Reader", 2, [70, 30]);
    reader.choose();
    reader.putBack();
    expect(reader.shown()).toBe("70,30");
    reader.unmount();

    // Forgotten, not merely overridden: a fresh mount starts there too.
    const again = widthsFor("Reader", 2, [70, 30]);
    expect(again.shown()).toBe("70,30");
    again.unmount();
  });
});
