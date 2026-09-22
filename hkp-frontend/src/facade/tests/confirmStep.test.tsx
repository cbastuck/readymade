import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { executeActions } from "../executeActions";
import { LayoutNode } from "../panels/LayoutNode";
import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import type { ConfirmAction, LayoutItem } from "../types";

/**
 * Consent as a step among a widget's actions rather than a field of one widget.
 *
 * A step can wait, and can end the sequence: declining stops what comes after
 * it and leaves what came before it done. That is what lets a board put the
 * question where it belongs, and what every later step that waits on a person
 * builds on.
 */

const processed: unknown[] = [];

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

describe("a confirm step", () => {
  it("stops the steps after it when declined, not the ones before", async () => {
    processed.length = 0;
    const written: Record<string, unknown> = {};
    await executeActions({
      actions: [
        { type: "set-state", key: "seen", value: true },
        { type: "confirm", question: "Send it?" },
        { type: "process", serviceUuid: "send", payload: {} },
      ],
      value: undefined,
      boardContext,
      setState: (key, value) => {
        written[key] = value;
      },
      ask: async () => false,
    });
    expect(written).toEqual({ seen: true });
    expect(processed).toEqual([]);
  });

  it("asks the question with the widget's value in it", async () => {
    processed.length = 0;
    const asked: ConfirmAction[] = [];
    await executeActions({
      actions: [
        { type: "confirm", question: "Send $$input?", agree: "Send" },
        { type: "process", serviceUuid: "send", payload: "$$input" },
      ],
      value: "hello",
      boardContext,
      setState: () => {},
      ask: async (step) => {
        asked.push(step);
        return true;
      },
    });
    expect(asked).toEqual([
      { type: "confirm", question: "Send hello?", agree: "Send" },
    ]);
    expect(processed).toEqual([{ uuid: "send", payload: "hello" }]);
  });

  it("asks nothing when the question is empty", async () => {
    processed.length = 0;
    const ask = vi.fn(async () => false);
    await executeActions({
      actions: [
        { type: "confirm", question: "" },
        { type: "process", serviceUuid: "send", payload: {} },
      ],
      value: undefined,
      boardContext,
      setState: () => {},
      ask,
    });
    expect(ask).not.toHaveBeenCalled();
    expect(processed).toEqual([{ uuid: "send", payload: {} }]);
  });

  it("declines where there is nobody to ask", async () => {
    processed.length = 0;
    await executeActions({
      actions: [
        { type: "confirm", question: "Send it?" },
        { type: "process", serviceUuid: "send", payload: {} },
      ],
      value: undefined,
      boardContext,
      setState: () => {},
    });
    expect(processed).toEqual([]);
  });
});

describe("a button with a confirm step", () => {
  const button = {
    type: "button",
    label: "Unsubscribe",
    actions: [
      {
        type: "confirm",
        question: "Stop reading this feed?",
        agree: "Unsubscribe",
        decline: "Keep reading",
      },
      { type: "process", serviceUuid: "feeds", payload: { remove: true } },
    ],
  } as unknown as LayoutItem;

  function renderButton() {
    return render(
      <LayoutNode
        item={button}
        boardContext={boardContext}
        panelContext={{ knobValues: {}, onKnobChange: () => {} }}
      />,
    );
  }

  it("names the answers the way the board wrote them", async () => {
    processed.length = 0;
    renderButton();
    fireEvent.click(screen.getByText("Unsubscribe"));
    expect(screen.getByText("Stop reading this feed?")).toBeTruthy();
    expect(screen.getByText("Keep reading")).toBeTruthy();
    expect(processed).toEqual([]);

    // The button and the agreeing answer share a label; the answer is the
    // one inside the dialog.
    fireEvent.click(
      screen.getByRole("dialog").querySelector("button:last-of-type")!,
    );
    await waitFor(() =>
      expect(processed).toEqual([{ uuid: "feeds", payload: { remove: true } }]),
    );
  });

  it("leaves the board alone when declined", async () => {
    processed.length = 0;
    renderButton();
    fireEvent.click(screen.getByText("Unsubscribe"));
    fireEvent.click(screen.getByText("Keep reading"));
    await Promise.resolve();
    expect(processed).toEqual([]);
  });
});
