import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { BoardCtx, BoardContextState } from "hkp-frontend/src/BoardContext";
import { PlayProvider } from "hkp-frontend/src/core/play";
import PlayBoardControls from "../PlayBoardControls";

function renderControls(extra?: React.ReactNode) {
  const processRuntime = vi.fn();
  const boardContext = {
    boardName: "Test Board",
    runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
    services: { ui: [{ uuid: "timer", serviceId: "timer" }] },
    scopes: { ui: { id: "ui" } },
    runtimeApis: { browser: { processRuntime } },
  } as unknown as BoardContextState;

  render(
    <BoardCtx.Provider value={boardContext}>
      <PlayProvider>
        <PlayBoardControls />
        {extra}
      </PlayProvider>
    </BoardCtx.Provider>,
  );
  return { processRuntime };
}

describe("the toolbar's play controls", () => {
  it("runs the board from the top, with nothing on the input", () => {
    const { processRuntime } = renderControls();

    fireEvent.click(screen.getByLabelText("Run the board"));
    expect(processRuntime).toHaveBeenCalledTimes(1);
    // Not an empty object: see `core/play`.
    expect(processRuntime.mock.calls[0][1]).toBeUndefined();
  });

  it("asks for an input instead of running, from the control beside it", () => {
    const { processRuntime } = renderControls();

    fireEvent.click(screen.getByLabelText("Run the board with parameters"));
    // A press of its own, not the plain one with something held: the board
    // waits for what to run it with.
    expect(processRuntime).not.toHaveBeenCalled();
    expect(screen.getByText("Run with parameters")).toBeDefined();
  });

  it("shares what was written with the board's other play control", () => {
    // A second control over the same board, standing in for the overview's.
    const { processRuntime } = renderControls(<PlayBoardControls />);

    fireEvent.click(
      screen.getAllByLabelText("Run the board with parameters")[0],
    );
    fireEvent.click(screen.getByText("Process Runtime"));
    expect(processRuntime).toHaveBeenCalledTimes(1);

    // The other one is armed too, and sends the same thing.
    const again = screen.getAllByLabelText("Run the board again");
    expect(again).toHaveLength(2);
    fireEvent.click(again[1]);
    expect(processRuntime.mock.calls[1][1]).toEqual(
      processRuntime.mock.calls[0][1],
    );
  });

  it("offers itself and refuses where there is nothing to run", () => {
    render(
      <BoardCtx.Provider
        value={
          {
            runtimes: [],
            services: {},
            scopes: {},
            runtimeApis: {},
          } as unknown as BoardContextState
        }
      >
        <PlayBoardControls />
      </BoardCtx.Provider>,
    );

    // Greyed out rather than absent: a control that comes and goes moves the
    // ones beside it, and is not somewhere to look for next time.
    expect(
      screen.getByLabelText("Run the board").hasAttribute("disabled"),
    ).toBe(true);
  });
});
