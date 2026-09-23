import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { LayoutNode } from "../panels/LayoutNode";
import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import type { LayoutItem } from "../types";

/**
 * A text widget that names somewhere to go.
 *
 * The case is a list of things to open — articles, documents, results — which
 * a facade could previously only display. Two things have to hold: the address
 * comes from the item, so a repeat gives each row its own destination, and a
 * row with nothing to open is not a link that goes nowhere.
 */

const notified: unknown[] = [];

vi.mock("../panels/renderers/StatusIndicatorRenderer", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../panels/renderers/StatusIndicatorRenderer")
  >()),
  useNotificationValue: (_ctx: unknown, source: { path?: string } | undefined) =>
    source ? notified[0] : undefined,
}));

vi.mock("../boardServices", () => ({
  findService: () => null,
  processService: () => {},
}));

const boardContext = {
  scopes: {},
  services: {},
  runtimes: [],
} as unknown as BoardContextState;

function renderNode(item: LayoutItem) {
  return render(
    <LayoutNode
      item={item}
      boardContext={boardContext}
      panelContext={{ knobValues: {}, onKnobChange: () => {} }}
    />,
  );
}

describe("a text widget with an href", () => {
  it("links each repeated row to its own address", () => {
    notified[0] = [
      { title: "First thing", link: "https://example.com/one" },
      { title: "Second thing", link: "https://example.com/two" },
    ];

    const { container } = renderNode({
      type: "repeat",
      source: { serviceUuid: "feeds", path: "items" },
      template: {
        type: "text",
        placeholder: "{{item.title}}",
        href: "{{item.link}}",
      },
    } as unknown as LayoutItem);

    const links = Array.from(container.querySelectorAll("a"));
    expect(
      links.map((a) => [a.getAttribute("href"), a.textContent]),
    ).toEqual([
      ["https://example.com/one", "First thing"],
      ["https://example.com/two", "Second thing"],
    ]);
    // A facade is the app; what it links to is not.
    expect(links[0].getAttribute("target")).toBe("_blank");
    expect(links[0].getAttribute("rel")).toContain("noopener");
  });

  it("renders no link where the widget was given no address", () => {
    const { container } = renderNode({
      type: "text",
      placeholder: "Just a line of prose",
    } as unknown as LayoutItem);

    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(container.textContent).toContain("Just a line of prose");
  });

  it("does not link a value the source has not filled in yet", () => {
    // An underlined placeholder that goes nowhere is worse than plain text:
    // it offers something the board cannot yet do.
    notified[0] = undefined;

    const { container } = renderNode({
      type: "text",
      source: { serviceUuid: "feeds", path: "title" },
      placeholder: "Nothing yet.",
      href: "https://example.com/one",
    } as unknown as LayoutItem);

    expect(container.querySelectorAll("a")).toHaveLength(0);
  });
});
