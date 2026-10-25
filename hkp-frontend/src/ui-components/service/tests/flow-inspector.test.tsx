import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

// The editor shows what it is handed, and keeps its text when handed none —
// as the real one does (shared/Editor's setValue).
vi.mock("hkp-frontend/src/components/shared/Editor", async () => {
  const React = await import("react");
  return {
    default: React.forwardRef(function Editor(
      { value }: { value?: string },
      ref: React.Ref<unknown>,
    ) {
      const [text, setText] = React.useState(value ?? "");
      React.useEffect(() => {
        if (value !== undefined) {
          setText(value);
        }
      }, [value]);
      React.useImperativeHandle(ref, () => ({ getValue: () => text, setValue: setText }));
      return React.createElement("pre", { "data-testid": "editor" }, text);
    }),
  };
});

import ServiceOutputPlug, {
  FlowRecord,
  FlowSide,
  rememberFlow,
} from "../ServiceOutputPlug";
import { isCapturing, setCapturing } from "hkp-frontend/src/runtime/captureMode";

/**
 * The Flow Inspector's histories, kept the way ServiceFrame keeps them: added
 * to where each value arrives, through a functional state update.
 */
let report: (data: unknown, at?: number) => void = () => {};
let receive: (data: unknown, at?: number) => void = () => {};
const onInject = vi.fn();
const onRerun = vi.fn();

function Frame({ canRerun = true }: { canRerun?: boolean }) {
  const [inputs, setInputs] = useState<FlowRecord[]>([]);
  const [outputs, setOutputs] = useState<FlowRecord[]>([]);
  report = (data, at) => setOutputs((prev) => rememberFlow(prev, data, at));
  receive = (data, at) => setInputs((prev) => rememberFlow(prev, data, at));
  return React.createElement(ServiceOutputPlug, {
    inputHistory: inputs,
    outputHistory: outputs,
    onClearHistory: (side: FlowSide) =>
      side === "input" ? setInputs([]) : setOutputs([]),
    onInject,
    onRerun: canRerun ? onRerun : undefined,
  });
}

function open() {
  fireEvent.click(
    screen.getByRole("button", { name: "Inspect input and output" }),
  );
}

/** Opens the inspector with its history list unfolded. */
function openHistory() {
  open();
  fireEvent.click(screen.getByRole("button", { name: /History/ }));
}

const entries = () => screen.queryAllByRole("option");

describe("Flow Inspector", () => {
  // What it shows of a call is what Capture mode sends; these are about
  // showing it, so the board is captured. Asking to be is below.
  beforeEach(() => setCapturing(true));
  afterEach(() => setCapturing(false));

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

  it("shows what the service received on the Input side, with Rerun", () => {
    onRerun.mockClear();
    render(React.createElement(Frame));
    act(() => {
      receive({ id: 1 });
      receive({ id: 2 });
      report({ out: 2 });
    });
    open();
    fireEvent.click(screen.getByRole("button", { name: /History/ }));
    expect(entries()).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Input" }));
    expect(entries()).toHaveLength(2);
    expect(entries()[0].textContent).toContain('{"id":2}');
    expect(screen.queryByRole("button", { name: /Inject/ })).toBeNull();

    fireEvent.click(entries()[1]);
    fireEvent.click(screen.getByRole("button", { name: /Rerun/ }));
    expect(onRerun).toHaveBeenCalledWith({ id: 1 });
  });

  it("injects an output downstream on the Output side", () => {
    onInject.mockClear();
    render(React.createElement(Frame));
    act(() => report({ out: 1 }));
    open();

    fireEvent.click(screen.getByRole("button", { name: /Inject/ }));
    expect(onInject).toHaveBeenCalledWith({ out: 1 });
  });

  it("shows how a value too large to keep began, and will not run it again", () => {
    onRerun.mockClear();
    render(React.createElement(Frame));
    act(() =>
      receive({
        __hkpTooLarge: {
          type: "string",
          bytes: 12 * 1024 * 1024,
          exact: true,
          preview: "the beginning",
        },
      }),
    );
    open();
    fireEvent.click(screen.getByRole("button", { name: "Input" }));

    expect(screen.getByRole("note").textContent).toBe(
      "Text of 12 MiB: too large to keep whole. Only how it begins is shown, and it cannot be run again from here.",
    );
    expect(screen.getByTestId("editor").textContent).toBe("the beginning");
    const rerun = screen.getByRole("button", { name: /Rerun/ }) as HTMLButtonElement;
    expect(rerun.disabled).toBe(true);
    fireEvent.click(rerun);
    expect(onRerun).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /History/ }));
    expect(entries()[0].textContent).toContain("Text of 12 MiB, too large to keep");
  });

  it("says when only a lower bound of the size is known, and will not inject it", () => {
    render(React.createElement(Frame));
    act(() =>
      report({ __hkpTooLarge: { type: "json", bytes: 5 * 1024 * 1024 + 1, exact: false } }),
    );
    open();

    expect(screen.getByRole("note").textContent).toBe(
      "JSON of more than 5 MiB: too large to keep whole. None of it is shown, and it cannot be carried on from here.",
    );
    expect(
      (screen.getByRole("button", { name: /Inject/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("says a service has received nothing, and offers no Rerun where it cannot", () => {
    render(React.createElement(Frame, { canRerun: false }));
    act(() => report({ tick: 1 }));
    open();

    fireEvent.click(screen.getByRole("button", { name: "Input" }));
    expect(screen.getByText(/Nothing received yet/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /Rerun/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("has the history and both sides when expanded, and keeps them going back", () => {
    render(React.createElement(Frame));
    act(() => {
      receive({ id: 1 });
      report({ out: 1 });
      report({ out: 2 });
    });
    open();
    fireEvent.click(screen.getByRole("button", { name: "Input" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Flow Inspector");
    expect(
      screen.getByRole("button", { name: "Input" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByRole("button", { name: /Rerun/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Output" }));
    fireEvent.click(screen.getByRole("button", { name: /History/ }));
    expect(entries()).toHaveLength(2);
    fireEvent.click(entries()[1]);

    // Back in the popover, which stayed open: the same side, history and choice.
    fireEvent.click(screen.getByRole("button", { name: "Back to popover" }));
    expect(screen.queryByRole("button", { name: "Back to popover" })).toBeNull();
    expect(entries()[1].getAttribute("aria-selected")).toBe("true");
  });

  it("clears the remembered outputs, and the next output starts a new history", () => {
    render(React.createElement(Frame));
    act(() => [1, 2, 3].forEach((n) => report({ n })));

    openHistory();
    expect(entries()).toHaveLength(3);

    expect(screen.getByTestId("editor").textContent).toContain('"n": 3');
    fireEvent.click(screen.getByRole("button", { name: "Clear history" }));
    expect(entries()).toHaveLength(0);
    // Nothing left to inject, so nothing left in the editor either.
    expect(screen.getByTestId("editor").textContent).toBe("");

    act(() => [4, 5].forEach((n) => report({ n })));
    expect(entries()).toHaveLength(2);
  });
});

describe("Opening the Flow Inspector without Capture mode", () => {
  beforeEach(() => setCapturing(false));
  afterEach(() => setCapturing(false));

  it("asks first, and turning Capture mode on from there opens it", () => {
    render(React.createElement(Frame));
    open();

    expect(screen.getByRole("dialog").textContent).toContain(
      "Capture mode is off, so the inspector shows that this service ran, but not what it received or passed on. Turn Capture mode on? It takes effect from the next run.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Turn on Capture mode" }));

    expect(isCapturing()).toBe(true);
    expect(screen.getByText("Flow Inspector")).toBeTruthy();
  });

  it("opens it all the same when the answer is not now", () => {
    render(React.createElement(Frame));
    open();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(isCapturing()).toBe(false);
    expect(screen.getByText("Flow Inspector")).toBeTruthy();
  });

  it("does not ask while the board is captured", () => {
    setCapturing(true);
    render(React.createElement(Frame));
    open();

    expect(screen.queryByText("Capture mode is off")).toBeNull();
    expect(screen.getByText("Flow Inspector")).toBeTruthy();
  });
});
