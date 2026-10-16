import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

function renderInput(inputType: "date" | "time" | "datetime") {
  const widget = {
    type: "text-input",
    label: "When",
    inputType,
    placeholder: "Pick one",
    submitLabel: "Propose it",
    actions: [
      { type: "process", serviceUuid: "put-up", payload: { starts: "$$input" } },
    ],
  } as LayoutItem;
  return render(
    <LayoutNode
      item={widget}
      boardContext={boardContext}
      panelContext={{ knobValues: {}, onKnobChange: () => {} }}
    />,
  );
}

const propose = () => fireEvent.click(screen.getByText("Propose it"));

describe("a text input asking for a date or a time", () => {
  beforeEach(() => {
    processed.length = 0;
    // A month known in advance: the calendar opens on the current one.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 10, 9, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is picked from a month and a time, and sends it as the browser would", async () => {
    renderInput("datetime");
    fireEvent.click(screen.getByText("Pick one"));

    // The month on show is this one.
    expect(screen.queryByLabelText("2026-10-01")).toBeNull();
    fireEvent.click(screen.getByLabelText("2026-09-24"));
    fireEvent.change(screen.getByLabelText("Hour"), { target: { value: "14" } });
    fireEvent.change(screen.getByLabelText("Minute"), { target: { value: "30" } });
    fireEvent.click(screen.getByText("Done"));
    propose();

    await waitFor(() =>
      expect(processed).toEqual([
        { serviceUuid: "put-up", payload: { starts: "2026-09-24T14:30" } },
      ]),
    );
  });

  it("turns to another month", async () => {
    renderInput("datetime");
    fireEvent.click(screen.getByText("Pick one"));

    fireEvent.click(screen.getByLabelText("Next month"));
    expect(screen.queryByLabelText("2026-09-24")).toBeNull();
    fireEvent.click(screen.getByLabelText("2026-10-01"));
    fireEvent.click(screen.getByText("Done"));
    propose();

    // A day picked before any time is late morning, to be moved from.
    await waitFor(() =>
      expect(processed).toEqual([
        { serviceUuid: "put-up", payload: { starts: "2026-10-01T10:00" } },
      ]),
    );
  });

  it("sends a day alone where only a day is asked for, and is done when it is picked", async () => {
    renderInput("date");
    fireEvent.click(screen.getByText("Pick one"));

    fireEvent.click(screen.getByLabelText("2026-09-24"));
    expect(screen.queryByLabelText("Hour")).toBeNull();
    await waitFor(() => expect(screen.queryByLabelText("2026-09-25")).toBeNull());
    propose();

    await waitFor(() =>
      expect(processed).toEqual([
        { serviceUuid: "put-up", payload: { starts: "2026-09-24" } },
      ]),
    );
  });

  it("asks for a time alone with the browser's own field", () => {
    const { container } = renderInput("time");
    expect(container.querySelector("input")?.type).toBe("time");
  });

  it("sends nothing before anything is picked", () => {
    renderInput("datetime");
    propose();
    expect(processed).toEqual([]);
  });
});
