import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import type { LayoutItem, SwimlaneWidget } from "../types";
import { LayoutNode } from "../panels/LayoutNode";
import { SwimlaneDragProvider } from "../SwimlaneDragContext";

/**
 * A lane that is a stage of work rather than a pile of cards.
 *
 * Which lane a card is in says how far it has got; what is happening to it
 * there — working, failed, and why — is said on the card, and what a person can
 * do about it is a button on the card, offered only where it applies.
 */

const rows = [
  {
    cardId: "a",
    laneId: "briefing",
    title: "Working one",
    status: "working",
    detail: "since 14:33",
    retryable: 0,
  },
  {
    cardId: "b",
    laneId: "briefing",
    title: "Failed one",
    status: "failed",
    detail: "no value stored for anthropic.key",
    retryable: 1,
  },
  {
    cardId: "c",
    laneId: "on-air",
    title: "Spoken one",
    audio: "http://example.test/episodes/c.mp3",
  },
  { cardId: "d", laneId: "on-air", title: "Silent one", audio: "" },
];

vi.mock("../panels/renderers/StatusIndicatorRenderer", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../panels/renderers/StatusIndicatorRenderer")
  >()),
  useNotificationValue: () => rows,
}));

const processed: Array<{ uuid: string; payload: unknown }> = [];

vi.mock("../boardServices", () => ({
  findService: () => null,
  processService: (_ctx: unknown, uuid: string, payload: unknown) => {
    processed.push({ uuid, payload });
  },
}));

const boardContext = {
  scopes: {},
  services: {},
  runtimes: [],
} as unknown as BoardContextState;

const briefing: SwimlaneWidget = {
  type: "swimlane",
  laneId: "briefing",
  title: "Reading list",
  source: { serviceUuid: "desk", path: "rows" },
  statusField: "status",
  statusColors: { working: "#f59e0b", failed: "#ef4444" },
  detailField: "detail",
  cardActions: [
    {
      label: "Retry",
      visibleWhen: { field: "retryable" },
      actions: [
        { type: "process", serviceUuid: "each.name", payload: { id: "{{item.cardId}}", retry: 1 } },
      ],
    },
    {
      label: "Use the feed's line",
      visibleWhen: { field: "status", equals: "failed" },
      actions: [
        { type: "process", serviceUuid: "fb-which", payload: { guid: "{{item.card.cardId}}" } },
      ],
    },
  ],
};

const onAir: SwimlaneWidget = {
  type: "swimlane",
  laneId: "on-air",
  title: "On air",
  source: { serviceUuid: "desk", path: "rows" },
  audioField: "audio",
};

function show() {
  processed.length = 0;
  const layout: LayoutItem = { direction: "row", items: [briefing, onAir] };
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

const card = (title: string) =>
  screen.getByText(title).closest("article") as HTMLElement;

describe("a card's state in its lane", () => {
  it("says what is happening to it, in the colour that status is given", () => {
    show();
    const working = card("Working one");
    const status = working.querySelector("[data-status]") as HTMLElement;

    expect(status.textContent).toBe("working");
    expect(status.style.color).toBe("rgb(245, 158, 11)");
    expect(within(working).getByText("since 14:33")).toBeTruthy();

    const failed = card("Failed one");
    expect(failed.querySelector("[data-status]")?.textContent).toBe("failed");
    expect(within(failed).getByText("no value stored for anthropic.key")).toBeTruthy();
  });

  it("shows nothing about a status a row does not have", () => {
    show();
    expect(card("Spoken one").querySelector("[data-status]")).toBeNull();
  });

  it("offers a card's buttons only where the row says they apply", () => {
    show();
    expect(within(card("Working one")).queryByRole("button", { name: "Retry" })).toBeNull();
    expect(
      within(card("Working one")).queryByRole("button", { name: "Use the feed's line" }),
    ).toBeNull();
    expect(within(card("Failed one")).getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(
      within(card("Failed one")).getByRole("button", { name: "Use the feed's line" }),
    ).toBeTruthy();
  });

  it("runs a card's button with that card", async () => {
    show();
    fireEvent.click(within(card("Failed one")).getByRole("button", { name: "Retry" }));
    fireEvent.click(
      within(card("Failed one")).getByRole("button", { name: "Use the feed's line" }),
    );

    await waitFor(() => expect(processed).toHaveLength(2));
    expect(processed[0]).toEqual({ uuid: "each.name", payload: { id: "b", retry: 1 } });
    expect(processed[1]).toEqual({ uuid: "fb-which", payload: { guid: "b" } });
  });
});

describe("a card that can be listened to", () => {
  it("gets a player for its address, and none without one", () => {
    show();
    const player = within(card("Spoken one")).getByLabelText("Play Spoken one");
    expect(player.getAttribute("src")).toBe("http://example.test/episodes/c.mp3");
    expect(within(card("Silent one")).queryByLabelText("Play Silent one")).toBeNull();
  });

  it("stops the card that was playing when another one starts", () => {
    rows.push({
      cardId: "e",
      laneId: "on-air",
      title: "Second spoken",
      audio: "http://example.test/episodes/e.mp3",
    });
    try {
      show();
      const first = within(card("Spoken one")).getByLabelText(
        "Play Spoken one",
      ) as HTMLAudioElement;
      const second = within(card("Second spoken")).getByLabelText(
        "Play Second spoken",
      ) as HTMLAudioElement;
      const paused = vi.spyOn(first, "pause").mockImplementation(() => {});

      fireEvent.play(first);
      fireEvent.play(second);

      expect(paused).toHaveBeenCalledTimes(1);
    } finally {
      rows.pop();
    }
  });
});
