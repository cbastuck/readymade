import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import type { LayoutItem } from "../types";
import { LayoutNode } from "../panels/LayoutNode";

const processed: unknown[] = [];

vi.mock("../boardServices", () => ({
  findService: () => null,
  processService: (_context: unknown, serviceUuid: string, payload: unknown) => {
    processed.push({ serviceUuid, payload });
  },
}));

const boardContext = {
  scopes: {},
  services: {},
  runtimes: [],
} as unknown as BoardContextState;

describe("a multiline text input", () => {
  beforeEach(() => {
    processed.length = 0;
  });

  it("keeps ordinary line breaks and submits with Ctrl+Enter", async () => {
    const widget = {
      type: "text-input",
      label: "Today's journal",
      placeholder: "What felt relevant today?",
      multiline: true,
      rows: 4,
      actions: [
        {
          type: "process",
          serviceUuid: "save-journal",
          payload: { journal: "$$input" },
        },
      ],
    } as LayoutItem;

    render(
      <LayoutNode
        item={widget}
        boardContext={boardContext}
        panelContext={{ knobValues: {}, onKnobChange: () => {} }}
      />,
    );

    const input = screen.getByPlaceholderText("What felt relevant today?");
    expect(input.tagName).toBe("TEXTAREA");
    expect(input.getAttribute("rows")).toBe("4");

    fireEvent.change(input, {
      target: { value: "Late lunch\nMigraine in the evening" },
    });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(processed).toEqual([]);

    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    await waitFor(() => {
      expect(processed).toEqual([
        {
          serviceUuid: "save-journal",
          payload: { journal: "Late lunch\nMigraine in the evening" },
        },
      ]);
    });
  });
});
