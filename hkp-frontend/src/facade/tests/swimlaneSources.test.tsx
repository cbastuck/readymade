import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import type { LayoutItem, SwimlaneWidget } from "../types";
import { LayoutNode } from "../panels/LayoutNode";
import { SwimlaneDragProvider } from "../SwimlaneDragContext";

/**
 * Lanes whose cards come from somewhere other than one query with a lane
 * column: a list of feeds, which knows nothing of lanes, and a feed's articles,
 * less the ones another lane already holds.
 */

const sources: Record<string, unknown> = {
  feeds: [
    { url: "https://hnrss.org/frontpage", name: "Hacker News" },
    { url: "https://lwn.net/headlines/rss", name: "LWN" },
  ],
  items: [
    { link: "https://a.example/1", title: "Kept already", feed: "Hacker News" },
    { link: "https://a.example/2", title: "Not kept yet", feed: "LWN" },
  ],
  desk: [{ cardId: "https://a.example/1", laneId: "reading", title: "Kept already" }],
};

vi.mock("../panels/renderers/StatusIndicatorRenderer", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../panels/renderers/StatusIndicatorRenderer")
  >()),
  useNotificationValue: (_ctx: unknown, source?: { serviceUuid: string }) =>
    source ? sources[source.serviceUuid] : undefined,
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

const feedsLane: SwimlaneWidget = {
  type: "swimlane",
  laneId: "sources",
  title: "Sources",
  source: { serviceUuid: "feeds" },
  allRows: true,
  cardIdField: "url",
  titleField: "name",
  descriptionField: "url",
};

const itemsLane: SwimlaneWidget = {
  type: "swimlane",
  laneId: "items",
  title: "Items",
  source: { serviceUuid: "items" },
  allRows: true,
  cardIdField: "link",
  descriptionField: "feed",
  except: { source: { serviceUuid: "desk" } },
};

const readingLane: SwimlaneWidget = {
  type: "swimlane",
  laneId: "reading",
  title: "Reading list",
  source: { serviceUuid: "desk" },
};

function show() {
  const layout: LayoutItem = {
    direction: "row",
    items: [feedsLane, itemsLane, readingLane],
  };
  return render(
    <SwimlaneDragProvider>
      <LayoutNode
        item={layout}
        boardContext={boardContext}
        panelContext={{ knobValues: {}, onKnobChange: () => {} }}
      />
    </SwimlaneDragProvider>,
  );
}

describe("lanes with sources of their own", () => {
  it("takes every row of a source whose rows name no lane", () => {
    show();
    const lane = screen.getByRole("region", { name: "Sources" });
    expect(within(lane).getByText("Hacker News")).toBeTruthy();
    expect(within(lane).getByText("LWN")).toBeTruthy();
    expect(within(lane).getByText("https://lwn.net/headlines/rss")).toBeTruthy();
  });

  it("leaves out the cards another source already holds", () => {
    show();
    const items = screen.getByRole("region", { name: "Items" });
    expect(within(items).getByText("Not kept yet")).toBeTruthy();
    expect(within(items).queryByText("Kept already")).toBeNull();
    // It is on the reading list instead: one card, one lane.
    const reading = screen.getByRole("region", { name: "Reading list" });
    expect(within(reading).getByText("Kept already")).toBeTruthy();
  });
});
