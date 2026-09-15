import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { LayoutNode } from "../panels/LayoutNode";
import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import type { LayoutItem } from "../types";

/**
 * A day drawn as a calendar.
 *
 * The widget's whole job is the arrangement: hours as an axis, one column per
 * thing being booked, every row the same height so a person can look down a
 * column and find a free afternoon. What it deliberately does *not* do is decide
 * anything — each cell arrives already knowing what it says, whose it is and
 * whether it is on offer, because the query that answered knows all three.
 *
 * So what is pinned here is that split: the geometry it draws from nothing but
 * the rows, and the fact that a cell's own state is what decides whether tapping
 * it does anything at all.
 */

const notified: unknown[] = [];

vi.mock("../panels/renderers/StatusIndicatorRenderer", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../panels/renderers/StatusIndicatorRenderer")
  >()),
  useNotificationValue: (_ctx: unknown, source: unknown) =>
    source ? notified[0] : undefined,
}));

const processed: unknown[] = [];

vi.mock("../boardServices", () => ({
  findService: () => null,
  processService: (_ctx: unknown, uuid: string, payload: unknown) => {
    processed.push({ uuid, payload });
  },
}));

const boardContext = { scopes: {}, services: {}, runtimes: [] } as unknown as BoardContextState;

function renderNode(item: LayoutItem) {
  return render(
    <LayoutNode
      item={item}
      boardContext={boardContext}
      panelContext={{ knobValues: {}, onKnobChange: () => {} }}
    />,
  );
}

/** Two hours of two courts, one cell in each state the widget knows. */
const rows = [
  { day: "2026-09-17", dayOffset: 0, column: 1, hour: 11, state: "free", label: "", prompt: "Book court 1 at 11:00?" },
  { day: "2026-09-17", dayOffset: 0, column: 2, hour: 11, state: "taken", label: "ben@club.example", prompt: "" },
  { day: "2026-09-17", dayOffset: 0, column: 1, hour: 12, state: "mine", label: "You", prompt: "Give back court 1 at 12:00?" },
  { day: "2026-09-17", dayOffset: 0, column: 2, hour: 12, state: "blocked", label: "", prompt: "" },
];

const calendar = {
  type: "calendar",
  source: { serviceUuid: "day-grid", path: "rows" },
  columns: ["Court 1", "Court 2"],
  confirm: "{{item.prompt}}",
  actions: [
    {
      type: "process",
      serviceUuid: "book",
      payload: {
        state: "{{item.state}}",
        court: "{{item.column}}",
        hour: "{{item.hour}}",
        dayOffset: "{{item.dayOffset}}",
      },
    },
  ],
} as unknown as LayoutItem;

function show(extra: Record<string, unknown> = {}) {
  notified.length = 0;
  notified.push(rows);
  processed.length = 0;
  return renderNode({ ...(calendar as Record<string, unknown>), ...extra } as unknown as LayoutItem);
}

describe("the calendar's geometry", () => {
  it("draws an hour axis covering the hours the rows mention", () => {
    show();
    expect(screen.getByText("11:00")).toBeTruthy();
    expect(screen.getByText("12:00")).toBeTruthy();
  });

  it("fills in hours no row mentions, so the axis has no gaps", () => {
    notified.length = 0;
    notified.push([
      { column: 1, hour: 9, state: "free" },
      { column: 1, hour: 12, state: "free" },
    ]);
    renderNode(calendar);
    for (const hour of ["09:00", "10:00", "11:00", "12:00"]) {
      expect(screen.getByText(hour)).toBeTruthy();
    }
  });

  it("honours an extent the board gave it", () => {
    show({ fromHour: 10, toHour: 13 });
    expect(screen.getByText("10:00")).toBeTruthy();
    expect(screen.getByText("13:00")).toBeTruthy();
  });

  it("names its columns and captions the day it is drawing", () => {
    show();
    expect(screen.getByText("Court 1")).toBeTruthy();
    expect(screen.getByText("Court 2")).toBeTruthy();
    expect(screen.getByText("2026-09-17")).toBeTruthy();
  });

  it("says so rather than drawing an empty frame when it has no cells", () => {
    notified.length = 0;
    notified.push(undefined);
    renderNode(calendar);
    expect(screen.getByText("Nothing to show yet.")).toBeTruthy();
  });
});

describe("what a cell's state decides", () => {
  it("shows what a taken hour says, and asks nothing when tapped", () => {
    show();
    const taken = screen.getByText("ben@club.example");
    expect(taken).toBeTruthy();
    fireEvent.click(taken);
    expect(processed).toEqual([]);
  });

  it("does not act on an hour that is not on offer", () => {
    show();
    // A blocked cell carries no label, so it is found by its position in the grid.
    const blocked = screen
      .getAllByRole("button")
      .find((b) => b.getAttribute("aria-label") === "12:00, not available");
    expect(blocked).toBeTruthy();
    fireEvent.click(blocked!);
    expect(processed).toEqual([]);
  });

  it("asks before taking a free hour, then sends the cell's own values", () => {
    show();
    const free = screen
      .getAllByRole("button")
      .find((b) => b.getAttribute("aria-label") === "11:00, free — tap to book");
    fireEvent.click(free!);
    expect(screen.getByText("Book court 1 at 11:00?")).toBeTruthy();
    expect(processed).toEqual([]);

    fireEvent.click(screen.getByText("Yes, do it"));
    // Numbers stay numbers: the statement binding $court is given 1, not "1".
    expect(processed).toEqual([
      {
        uuid: "book",
        payload: { state: "free", court: 1, hour: 11, dayOffset: 0 },
      },
    ]);
  });

  it("asks a different question of your own hour", () => {
    show();
    fireEvent.click(screen.getByText("You"));
    expect(screen.getByText("Give back court 1 at 12:00?")).toBeTruthy();
    fireEvent.click(screen.getByText("Yes, do it"));
    expect(processed).toEqual([
      {
        uuid: "book",
        payload: { state: "mine", court: 1, hour: 12, dayOffset: 0 },
      },
    ]);
  });

  it("marks a free hour so it reads as something to tap", () => {
    show();
    // The bug this pins: drawn with no mark, a free hour is indistinguishable
    // from one that is merely not on offer, and nothing on the calendar looks
    // like a control at all.
    const free = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-label")?.includes("free"));
    expect(free).toHaveLength(1);
    expect(free[0].textContent).toBe("+");

    const blocked = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-label")?.includes("not available"));
    expect(blocked[0].textContent).toBe("");
  });

  it("says what each cell is, in words, for anyone not reading the grid", () => {
    show();
    const said = screen
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label"));
    expect(said).toContain("11:00, free — tap to book");
    expect(said).toContain("11:00, taken by ben@club.example");
    expect(said).toContain("12:00, booked by you — tap to give it back");
    expect(said).toContain("12:00, not available");
  });

  it("leaves the day alone when the question is declined", () => {
    show();
    fireEvent.click(screen.getByText("You"));
    fireEvent.click(screen.getByText("Keep as it is"));
    expect(processed).toEqual([]);
  });
});
