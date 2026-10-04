import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { executeActions } from "../executeActions";
import { LayoutNode } from "../panels/LayoutNode";
import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import type { LayoutItem, PromptAction } from "../types";

/**
 * Asking for a value as a step among a widget's actions: the answer is what
 * `$$input` means from there on, and cancelling ends the sequence the way
 * declining a confirm does.
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

describe("a prompt step", () => {
  it("hands the answer to the steps after it as $$input", async () => {
    processed.length = 0;
    const written: Record<string, unknown> = {};
    await executeActions({
      actions: [
        { type: "prompt", question: "New name?" },
        { type: "set-state", key: "name" },
        { type: "process", serviceUuid: "rename", payload: { to: "$$input" } },
      ],
      value: "the widget's own",
      boardContext,
      setState: (key, value) => {
        written[key] = value;
      },
      askValue: async () => "anna",
    });
    expect(written).toEqual({ name: "anna" });
    expect(processed).toEqual([{ uuid: "rename", payload: { to: "anna" } }]);
  });

  it("stops the steps after it when cancelled, not the ones before", async () => {
    processed.length = 0;
    const written: Record<string, unknown> = {};
    await executeActions({
      actions: [
        { type: "set-state", key: "seen", value: true },
        { type: "prompt", question: "New name?" },
        { type: "process", serviceUuid: "rename", payload: {} },
      ],
      value: undefined,
      boardContext,
      setState: (key, value) => {
        written[key] = value;
      },
      askValue: async () => null,
    });
    expect(written).toEqual({ seen: true });
    expect(processed).toEqual([]);
  });

  it("cancels where there is nobody to ask", async () => {
    processed.length = 0;
    await executeActions({
      actions: [
        { type: "prompt", question: "New name?" },
        { type: "process", serviceUuid: "rename", payload: {} },
      ],
      value: undefined,
      boardContext,
      setState: () => {},
    });
    expect(processed).toEqual([]);
  });

  it("asks with its question and starting value substituted", async () => {
    const asked: PromptAction[] = [];
    await executeActions({
      actions: [
        {
          type: "prompt",
          question: "Rename $$input?",
          defaultValue: { $state: "current" },
        },
      ],
      value: "the list",
      state: { current: 42 },
      boardContext,
      setState: () => {},
      askValue: async (step) => {
        asked.push(step);
        return null;
      },
    });
    expect(asked).toEqual([
      { type: "prompt", question: "Rename the list?", defaultValue: 42 },
    ]);
  });
});

describe("a button with a prompt step", () => {
  const button = {
    type: "button",
    label: "Rename",
    actions: [
      { type: "prompt", question: "What is it called?", defaultValue: "old" },
      { type: "process", serviceUuid: "rename", payload: { to: "$$input" } },
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

  it("starts the field at the value being changed, and sends what was typed", async () => {
    processed.length = 0;
    renderButton();
    fireEvent.click(screen.getByText("Rename"));

    const field = screen.getByRole("textbox", { name: "What is it called?" });
    expect((field as HTMLInputElement).value).toBe("old");
    fireEvent.change(field, { target: { value: "new" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() =>
      expect(processed).toEqual([{ uuid: "rename", payload: { to: "new" } }]),
    );
  });

  it("sends on Enter", async () => {
    processed.length = 0;
    renderButton();
    fireEvent.click(screen.getByText("Rename"));
    const field = screen.getByRole("textbox", { name: "What is it called?" });
    fireEvent.change(field, { target: { value: "typed" } });
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() =>
      expect(processed).toEqual([{ uuid: "rename", payload: { to: "typed" } }]),
    );
  });

  it("sends nothing when cancelled", async () => {
    processed.length = 0;
    renderButton();
    fireEvent.click(screen.getByText("Rename"));
    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(processed).toEqual([]);
  });
});
