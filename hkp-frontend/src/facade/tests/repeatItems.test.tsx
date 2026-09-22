import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { LayoutNode } from "../panels/LayoutNode";
import { interpolateTemplate } from "../itemTemplate";
import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import type { LayoutItem } from "../types";

/**
 * A repeated widget takes its items from what a service is saying.
 *
 * The case this exists for is a query result that is a set of *controls* rather
 * than a table to look at: a timetable of free hours, a row of devices to pick
 * from. Before this, a service's rows could only be displayed, so anything
 * clickable had to be written out in the board — which is impossible when the
 * board does not know at design time how many there will be, or what state each
 * one is in.
 *
 * Two things have to hold for that to be usable, and both are pinned here: the
 * item decides the payload's *values* and not merely a label's text, and a
 * control the item says is not on offer cannot be pressed.
 */

const notified: unknown[] = [];

// Only the reading of a notification is stood in for; the widget registry
// imports the rest of this module, so the real exports have to stay.
vi.mock("../panels/renderers/StatusIndicatorRenderer", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../panels/renderers/StatusIndicatorRenderer")
  >()),
  useNotificationValue: (_ctx: unknown, source: { path?: string } | undefined) =>
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

/** A slot grid as a query would hand it over: already laid out, in order. */
const rows = [
  { court: 1, hour: 9, label: "free", intent: "book", locked: 0 },
  { court: 2, hour: 9, label: "ben@club.example", intent: "none", locked: 1 },
];

const grid = {
  type: "repeat",
  source: { serviceUuid: "day-grid", path: "rows" },
  columns: 2,
  template: {
    type: "button",
    label: "{{item.label}}",
    disabled: "{{item.locked}}",
    actions: [
      {
        type: "process",
        serviceUuid: "book",
        payload: {
          court: "{{item.court}}",
          hour: "{{item.hour}}",
          intent: "{{item.intent}}",
        },
      },
    ],
  },
} as unknown as LayoutItem;

describe("items from a service", () => {
  it("renders one control per row the service reported", () => {
    notified.length = 0;
    notified.push(rows);
    renderNode(grid);
    expect(screen.getByText("free")).toBeTruthy();
    expect(screen.getByText("ben@club.example")).toBeTruthy();
  });

  it("renders nothing before the service has said anything", () => {
    notified.length = 0;
    notified.push(undefined);
    const { container } = renderNode(grid);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("sends the row's own values, with their types intact", () => {
    notified.length = 0;
    notified.push(rows);
    processed.length = 0;
    renderNode(grid);
    fireEvent.click(screen.getByText("free"));
    // Numbers stay numbers: a statement binding $court would otherwise be given
    // the string "1", and a board would have to convert what it never converted.
    expect(processed).toEqual([
      { uuid: "book", payload: { court: 1, hour: 9, intent: "book" } },
    ]);
  });

  it("does not act on a row that says it is not on offer", () => {
    notified.length = 0;
    notified.push(rows);
    processed.length = 0;
    renderNode(grid);
    fireEvent.click(screen.getByText("ben@club.example"));
    expect(processed).toEqual([]);
  });

  it("still prefers items a board wrote over a source", () => {
    notified.length = 0;
    notified.push(rows);
    renderNode({
      ...(grid as Record<string, unknown>),
      items: [{ label: "written", locked: 1, court: 0, hour: 0, intent: "none" }],
    } as unknown as LayoutItem);
    expect(screen.getByText("written")).toBeTruthy();
    expect(screen.queryByText("free")).toBeNull();
  });
});

describe("an item reference", () => {
  it("substitutes a whole value so its type survives", () => {
    expect(interpolateTemplate("{{item.hour}}", { hour: 9 })).toBe(9);
    expect(interpolateTemplate("{{item.locked}}", { locked: 0 })).toBe(0);
    expect(interpolateTemplate("{{item}}", { a: 1 })).toEqual({ a: 1 });
  });

  it("prints into a longer string, for a sentence a person reads", () => {
    expect(
      interpolateTemplate("Book court {{item.court}} at {{item.hour}}:00?", {
        court: 2,
        hour: 12,
      }),
    ).toBe("Book court 2 at 12:00?");
  });

  it("reads a dotted path, and leaves a missing one empty", () => {
    expect(interpolateTemplate("{{item.a.b}}", { a: { b: "deep" } })).toBe("deep");
    expect(interpolateTemplate("x{{item.nope}}y", { a: 1 })).toBe("xy");
  });

  it("leaves text that is not a reference alone", () => {
    expect(interpolateTemplate("{{ item }}", { a: 1 })).toBe("{{ item }}");
    expect(interpolateTemplate("plain", { a: 1 })).toBe("plain");
  });
});

/**
 * Consent, where an action is not one to take on a single tap.
 *
 * The board this is for books and cancels a court from the same grid, so the
 * difference between the two is which cell was tapped — exactly the case where
 * a person should be told what is about to happen before it does.
 */
describe("a button that asks first", () => {
  const asking = {
    type: "button",
    label: "Take it",
    confirm: "Book court 2 at 12:00?",
    actions: [{ type: "process", serviceUuid: "book", payload: { court: 2 } }],
  } as unknown as LayoutItem;

  it("does nothing until the question is answered", () => {
    processed.length = 0;
    renderNode(asking);
    fireEvent.click(screen.getByText("Take it"));
    expect(screen.getByText("Book court 2 at 12:00?")).toBeTruthy();
    expect(processed).toEqual([]);
  });

  it("acts once, on agreement", async () => {
    processed.length = 0;
    renderNode(asking);
    fireEvent.click(screen.getByText("Take it"));
    fireEvent.click(screen.getByText("Yes, do it"));
    await waitFor(() =>
      expect(processed).toEqual([{ uuid: "book", payload: { court: 2 } }]),
    );
  });

  it("leaves the board alone when declined", () => {
    processed.length = 0;
    renderNode(asking);
    fireEvent.click(screen.getByText("Take it"));
    fireEvent.click(screen.getByText("Keep as it is"));
    expect(processed).toEqual([]);
  });

  it("goes straight through when there is nothing to ask", () => {
    processed.length = 0;
    renderNode({
      type: "button",
      label: "Refresh",
      actions: [{ type: "process", serviceUuid: "grid", payload: {} }],
    } as unknown as LayoutItem);
    fireEvent.click(screen.getByText("Refresh"));
    expect(processed).toEqual([{ uuid: "grid", payload: {} }]);
  });
});

/**
 * Alternating backgrounds, so a list of items reads as separate things.
 *
 * A repeat whose template is more than one line — a title, a byline, a summary —
 * runs together on screen: nothing says where one item ends and the next begins
 * except a gap that looks like the gaps inside an item. A band behind every
 * second one is what separates them, and it belongs to the repeat rather than
 * the template because which of the two colours an item sits on is a fact about
 * its position in the list, not about the item.
 */
describe("striped items", () => {
  const striped = {
    type: "repeat",
    items: [{ label: "one" }, { label: "two" }, { label: "three" }],
    stripe: { even: "rgb(10, 10, 10)", odd: "rgb(20, 20, 20)", padding: 8, radius: 6 },
    template: { type: "text", placeholder: "{{item.label}}" },
  } as unknown as LayoutItem;

  it("alternates the two colours, starting with even", () => {
    const { container } = renderNode(striped);
    const bands = Array.from(container.firstElementChild!.children) as HTMLElement[];
    expect(bands.map((band) => band.style.background)).toEqual([
      "rgb(10, 10, 10)",
      "rgb(20, 20, 20)",
      "rgb(10, 10, 10)",
    ]);
    expect(bands[0].style.padding).toBe("8px");
    expect(bands[0].style.borderRadius).toBe("6px");
  });

  it("wraps nothing extra around an unstriped repeat", () => {
    const { container } = renderNode({
      type: "repeat",
      items: [{ label: "one" }],
      template: { type: "text", placeholder: "{{item.label}}" },
    } as unknown as LayoutItem);
    const first = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(first.style.background).toBe("");
  });
});
