import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { BoardCtx, BoardContextState } from "hkp-frontend/src/BoardContext";
import { OverviewProvider, useOverview } from "../OverviewContext";
import OverviewView from "../OverviewView";

beforeAll(() => {
  // There is no 2D context in here, and the view already draws nothing when it
  // cannot get one. Saying so plainly keeps jsdom from reporting it as a fault.
  HTMLCanvasElement.prototype.getContext = () => null;
});

/**
 * The bar, with a board under it. Nothing is drawn in here — that needs a
 * browser — so this is about the controls around the canvas: whether pressing
 * play starts the board, and whether what it was given comes back.
 */
function renderOverview() {
  const processRuntime = vi.fn();
  const boardContext = {
    boardName: "Test Board",
    runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
    services: { ui: [{ uuid: "timer", serviceId: "timer" }] },
    scopes: { ui: { id: "ui" } },
    runtimeApis: { browser: { processRuntime } },
  } as unknown as BoardContextState;

  function Opener() {
    const overview = useOverview();
    return (
      <button onClick={() => overview?.show()} data-testid="open">
        open
      </button>
    );
  }

  render(
    <BoardCtx.Provider value={boardContext}>
      <OverviewProvider>
        <Opener />
        <OverviewView />
      </OverviewProvider>
    </BoardCtx.Provider>,
  );
  fireEvent.click(screen.getByTestId("open"));
  return { processRuntime };
}

describe("the overview's bar", () => {
  it("runs the board from the top, with nothing on the input", () => {
    const { processRuntime } = renderOverview();

    fireEvent.click(screen.getByLabelText("Run the board"));
    expect(processRuntime).toHaveBeenCalledTimes(1);
    expect(processRuntime.mock.calls[0][1]).toBeUndefined();
  });

  it("offers what it was last given here as the next press", () => {
    const { processRuntime } = renderOverview();

    fireEvent.click(screen.getByLabelText("Run the board"), { altKey: true });
    fireEvent.click(screen.getByText("Process Runtime"));
    expect(processRuntime).toHaveBeenCalledTimes(1);

    // Written once, and from then on a press away — a board is usually worth
    // watching with the same input arriving again.
    fireEvent.click(screen.getByLabelText("Run the board again"));
    expect(processRuntime).toHaveBeenCalledTimes(2);
    expect(processRuntime.mock.calls[1][1]).toEqual(
      processRuntime.mock.calls[0][1],
    );
  });
});

describe("the overview's layout control", () => {
  it("opens side by side, and says which layout is on", () => {
    window.localStorage.removeItem("hkp-overview-layout");
    renderOverview();

    expect(screen.getByLabelText("Lay nested pipelines side by side").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByLabelText("Stack nested pipelines below their host").getAttribute("aria-pressed")).toBe("false");
  });

  it("switches layout, and remembers the choice for next time", () => {
    window.localStorage.removeItem("hkp-overview-layout");
    renderOverview();

    fireEvent.click(screen.getByLabelText("Stack nested pipelines below their host"));
    expect(screen.getByLabelText("Stack nested pipelines below their host").getAttribute("aria-pressed")).toBe("true");
    expect(window.localStorage.getItem("hkp-overview-layout")).toBe("stacked");
  });

  it("opens in the layout last chosen", () => {
    window.localStorage.setItem("hkp-overview-layout", "stacked");
    renderOverview();

    expect(screen.getByLabelText("Stack nested pipelines below their host").getAttribute("aria-pressed")).toBe("true");
    window.localStorage.removeItem("hkp-overview-layout");
  });
});
