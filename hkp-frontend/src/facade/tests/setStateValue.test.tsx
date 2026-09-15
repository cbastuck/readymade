import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { LayoutNode } from "../panels/LayoutNode";
import { FacadeStateContext } from "../FacadeStateContext";
import { executeActions } from "../executeActions";
import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import type { LayoutItem } from "../types";

/**
 * A button that publishes the item it stands for.
 *
 * The case is a list of things a board did not know at design time — the
 * meetings on a poll board, one button each — where pressing one has to *pick*
 * it, not merely act on it: the panel's other widgets read the choice out of
 * facade state. A button has no value of its own, so without a written one
 * such a list could be rendered and never picked from.
 *
 * The value is taken from the item, which is what makes one written control
 * serve every row.
 */

const notified: unknown[] = [];

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

const written: { key: string; value: unknown }[] = [];

function renderNode(item: LayoutItem) {
  return render(
    <FacadeStateContext.Provider
      value={{
        state: { poll: "Sprint review" },
        setState: (key, value) => written.push({ key, value }),
      }}
    >
      <LayoutNode
        item={item}
        boardContext={boardContext}
        panelContext={{ knobValues: {}, onKnobChange: () => {} }}
      />
    </FacadeStateContext.Provider>,
  );
}

/** The meetings, as the query hands them over: each row already a control. */
const meetings = [
  { name: "Sprint review", label: "• Sprint review" },
  { name: "Roadmap review", label: "Roadmap review" },
];

const picker = {
  type: "repeat",
  source: { serviceUuid: "the-meetings", path: "rows" },
  direction: "row",
  template: {
    type: "button",
    label: "{{item.label}}",
    actions: [
      { type: "set-state", key: "poll", value: "{{item.name}}" },
      {
        type: "process",
        serviceUuid: "open-poll",
        payload: { intent: "none", poll: "{{item.name}}" },
      },
    ],
  },
} as unknown as LayoutItem;

describe("a button that picks", () => {
  it("publishes the item it was drawn for", () => {
    notified.length = 0;
    notified.push(meetings);
    written.length = 0;
    renderNode(picker);
    fireEvent.click(screen.getByText("Roadmap review"));
    expect(written).toEqual([{ key: "poll", value: "Roadmap review" }]);
  });

  it("carries the same choice into the action beside it", () => {
    notified.length = 0;
    notified.push(meetings);
    processed.length = 0;
    renderNode(picker);
    fireEvent.click(screen.getByText("Roadmap review"));
    // Not read back out of state: setState lands after this pass, so an action
    // that referenced { $state: "poll" } here would still be sent the meeting
    // being left rather than the one being picked.
    expect(processed).toEqual([
      { uuid: "open-poll", payload: { intent: "none", poll: "Roadmap review" } },
    ]);
  });
});

describe("what set-state writes", () => {
  const publish = async (act: Record<string, unknown>, value: unknown) => {
    const seen: { key: string; value: unknown }[] = [];
    await executeActions({
      actions: [act as never],
      value,
      boardContext,
      setState: (key, written) => seen.push({ key, value: written }),
      state: {},
    });
    return seen;
  };

  it("stores the widget's own value when nothing is written", async () => {
    expect(await publish({ type: "set-state", key: "you" }, "anna@example.com")).toEqual([
      { key: "you", value: "anna@example.com" },
    ]);
  });

  it("prefers a written value over the widget's", async () => {
    expect(
      await publish({ type: "set-state", key: "poll", value: "Roadmap review" }, "typed"),
    ).toEqual([{ key: "poll", value: "Roadmap review" }]);
  });

  it("keeps a value's type, so a number is not published as text", async () => {
    expect(await publish({ type: "set-state", key: "seat", value: 4 }, "9")).toEqual([
      { key: "seat", value: 4 },
    ]);
  });
});
