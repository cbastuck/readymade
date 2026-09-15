import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { LayoutNode } from "../panels/LayoutNode";
import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import type { LayoutItem } from "../types";

/**
 * A container's padding, per axis.
 *
 * `padding` was one number for both axes, which is the wrong unit for a panel:
 * a column wants room at its sides without its first widget being pushed down
 * from the title above it. So each axis can be said on its own, and what is
 * pinned here is how the two interact — and that the result is four longhands
 * rather than a shorthand mixed with one, which React warns about and whose
 * winner would depend on key order.
 */

vi.mock("../boardServices", () => ({
  findService: () => null,
  processService: () => {},
}));

const boardContext = {
  scopes: {},
  services: {},
  runtimes: [],
} as unknown as BoardContextState;

/** The padding a container ends up drawing, as the four sides. */
function paddingOf(container: Partial<LayoutItem>) {
  const { container: dom } = render(
    <LayoutNode
      item={{ direction: "column", items: [], ...container } as LayoutItem}
      boardContext={boardContext}
      panelContext={{ knobValues: {}, onKnobChange: () => {} }}
    />,
  );
  const style = (dom.firstElementChild as HTMLElement).style;
  return {
    left: style.paddingLeft,
    right: style.paddingRight,
    top: style.paddingTop,
    bottom: style.paddingBottom,
  };
}

describe("a container's padding", () => {
  it("says nothing when the board said nothing", () => {
    expect(paddingOf({})).toEqual({
      left: "",
      right: "",
      top: "",
      bottom: "",
    });
  });

  it("puts one number on all four sides", () => {
    const padding = paddingOf({ padding: 16 });
    expect([padding.left, padding.right, padding.top, padding.bottom]).toEqual([
      "16px",
      "16px",
      "16px",
      "16px",
    ]);
  });

  it("takes each axis on its own", () => {
    const padding = paddingOf({ paddingX: 16, paddingY: 4 });
    expect([padding.left, padding.right]).toEqual(["16px", "16px"]);
    expect([padding.top, padding.bottom]).toEqual(["4px", "4px"]);
  });

  it("lets an axis override the pair", () => {
    // Room at the sides, none above — a column under a panel title.
    const padding = paddingOf({ padding: 16, paddingY: 0 });
    expect([padding.left, padding.right]).toEqual(["16px", "16px"]);
    expect([padding.top, padding.bottom]).toEqual(["0px", "0px"]);
  });

  it("lets the other axis override the pair too", () => {
    const padding = paddingOf({ padding: 8, paddingX: 20 });
    expect([padding.left, padding.right]).toEqual(["20px", "20px"]);
    expect([padding.top, padding.bottom]).toEqual(["8px", "8px"]);
  });

  it("keeps a zero, rather than reading it as nothing said", () => {
    // 0 is an answer — flush to the edge — and `??` is what keeps it from
    // falling through to the pair the way `||` would.
    const padding = paddingOf({ padding: 12, paddingX: 0 });
    expect([padding.left, padding.right]).toEqual(["0px", "0px"]);
    expect([padding.top, padding.bottom]).toEqual(["12px", "12px"]);
  });
});
