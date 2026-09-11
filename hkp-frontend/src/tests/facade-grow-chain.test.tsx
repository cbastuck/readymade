import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import { LayoutNode, isContainer } from "../facade/panels/LayoutNode";
import { FacadeDescriptor, LayoutItem } from "../facade/types";

/**
 * Whether a widget that fills its panel still does after being nested.
 *
 * A leaf's `grow` only divides up space its parent actually has: a container
 * gets `flex: 1` from its own `grow`/`fill` and from nothing else. So wrapping
 * a growing widget in a plain container silently collapses it to the height of
 * its content — for a message list with nothing in it yet, to nothing at all.
 */

vi.mock("../facade/boardServices", () => ({
  findService: () => undefined,
  processService: () => {},
}));

const boardContext = { scopes: {}, services: {}, runtimes: [] } as any;
const panelContext = { knobValues: {}, onKnobChange: () => {} };

function renderLayout(item: LayoutItem) {
  return render(
    <LayoutNode
      item={item}
      boardContext={boardContext}
      panelContext={panelContext}
    />,
  );
}

/** Every ancestor of the first growing leaf, from the layout root down. */
function chainToGrowingLeaf(item: LayoutItem): LayoutItem[] | null {
  if (!isContainer(item)) {
    return "grow" in item && item.grow ? [item] : null;
  }
  for (const child of item.items) {
    const found = chainToGrowingLeaf(child);
    if (found) {
      return [item, ...found];
    }
  }
  return null;
}

describe("growing a widget through nested containers", () => {
  it("gives a growing container flex:1 and a plain one none", () => {
    const leaf = {
      type: "text" as const,
      source: { serviceUuid: "x" },
      grow: true,
    };

    const plain = renderLayout({ direction: "column", items: [leaf] });
    expect(plain.container.firstElementChild).toHaveProperty("style.flex", "");

    const growing = renderLayout({
      direction: "column",
      grow: true,
      items: [leaf],
    });
    expect(growing.container.firstElementChild).toHaveProperty(
      "style.flex",
      // jsdom expands the shorthand.
      "1 1 0%",
    );
  });

  it("keeps the peer-chat message list filling its panel", () => {
    const board = JSON.parse(
      readFileSync("boards/peer-chat-board.json", "utf-8"),
    ) as { facade: FacadeDescriptor };
    const panel = board.facade.panels.find((p) => p.id === "chat");
    expect(panel).toBeDefined();

    const chain = chainToGrowingLeaf(panel!.layout);
    expect(chain).not.toBeNull();

    // The list is the growing leaf, and every container above it grows too —
    // one that does not is where the height stops being handed down.
    const [leaf] = chain!.slice(-1);
    expect((leaf as any).type).toBe("message-list");
    for (const node of chain!.slice(0, -1)) {
      expect((node as any).grow || (node as any).fill).toBeTruthy();
    }
  });
});
