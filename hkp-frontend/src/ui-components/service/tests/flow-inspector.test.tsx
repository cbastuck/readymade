import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import ServiceOutputPlug, {
  OutputRecord,
  rememberOutput,
} from "../ServiceOutputPlug";

/**
 * The Flow Inspector's history, kept the way ServiceFrame keeps it: added to
 * where each output arrives, through a functional state update.
 */
let report: (data: unknown, at?: number) => void = () => {};

function Frame() {
  const [history, setHistory] = useState<OutputRecord[]>([]);
  report = (data, at) => setHistory((prev) => rememberOutput(prev, data, at));
  return React.createElement(ServiceOutputPlug, {
    history,
    onClearHistory: () => setHistory([]),
    onInject: vi.fn(),
  });
}

function open() {
  fireEvent.click(screen.getByRole("button", { name: "Inspect output" }));
}

/** Opens the inspector with its history list unfolded. */
function openHistory() {
  open();
  fireEvent.click(screen.getByRole("button", { name: /History/ }));
}

const entries = () => screen.queryAllByRole("option");

describe("Flow Inspector", () => {
  it("keeps every output of a burst rendered at once, as an Iterator's items are", () => {
    render(React.createElement(Frame));
    act(() => {
      for (let n = 1; n <= 10; n++) {
        report({ n });
      }
    });

    openHistory();
    expect(entries()).toHaveLength(10);
    expect(entries()[0].textContent).toContain('{"n":10}');
    expect(entries()[9].textContent).toContain('{"n":1}');
  });

  it("keeps the last ten", () => {
    render(React.createElement(Frame));
    act(() => {
      for (let n = 1; n <= 12; n++) {
        report({ n });
      }
    });

    openHistory();
    expect(entries()).toHaveLength(10);
    expect(entries()[9].textContent).toContain('{"n":3}');
  });

  it("says when each output arrived, to the millisecond", () => {
    render(React.createElement(Frame));
    const at = new Date(2026, 9, 23, 14, 32, 5, 7).getTime();
    act(() => report({ n: 1 }, at));

    openHistory();
    expect(entries()[0].textContent).toContain("14:32:05.007");
  });

  it("selects an output by clicking it or with the arrow keys", () => {
    render(React.createElement(Frame));
    act(() => [1, 2, 3].forEach((n) => report({ n })));
    openHistory();

    fireEvent.click(entries()[2]);
    expect(entries()[2].getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(screen.getByRole("listbox"), { key: "ArrowUp" });
    expect(entries()[1].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "ArrowUp" });
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "ArrowUp" });
    expect(entries()[0].getAttribute("aria-selected")).toBe("true");
  });

  it("starts with the history folded, saying when the latest output arrived", () => {
    render(React.createElement(Frame));
    const at = new Date(2026, 9, 23, 14, 32, 5, 7).getTime();
    act(() => {
      report({ n: 1 }, at - 1000);
      report({ n: 2 }, at);
    });

    open();
    const toggle = screen.getByRole("button", { name: /History/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toContain("History · 2");
    expect(toggle.textContent).toContain("latest 14:32:05.007");
    expect(entries()).toHaveLength(0);

    fireEvent.click(toggle);
    expect(entries()).toHaveLength(2);
    fireEvent.click(toggle);
    expect(entries()).toHaveLength(0);
  });

  it("clears the remembered outputs, and the next output starts a new history", () => {
    render(React.createElement(Frame));
    act(() => [1, 2, 3].forEach((n) => report({ n })));

    openHistory();
    expect(entries()).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "Clear history" }));
    expect(entries()).toHaveLength(0);

    act(() => [4, 5].forEach((n) => report({ n })));
    expect(entries()).toHaveLength(2);
  });
});
