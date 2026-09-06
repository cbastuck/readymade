import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { BoardCtx, BoardContextState } from "hkp-frontend/src/BoardContext";
import { OverviewProvider, useOverview } from "../OverviewContext";
import OverviewToolbarButton from "../OverviewToolbarButton";

/**
 * The toolbar's overview control opens the view, and once the view has been
 * used to open a service it is the way back to it.
 */

const board = {
  services: { ui: [{ uuid: "h1", serviceId: "sub-service" }] },
} as unknown as BoardContextState;

const emptyBoard = { services: { ui: [] } } as unknown as BoardContextState;

let api: ReturnType<typeof useOverview>;

function Probe() {
  api = useOverview();
  return <span data-testid="visible">{String(api?.visible)}</span>;
}

function renderToolbar(context: BoardContextState = board) {
  return render(
    <BoardCtx.Provider value={context}>
      <OverviewProvider>
        <Probe />
        <OverviewToolbarButton />
      </OverviewProvider>
    </BoardCtx.Provider>,
  );
}

describe("the toolbar's overview control", () => {
  it("offers to show the view", () => {
    renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: "Show overview" }));
    expect(screen.getByTestId("visible").textContent).toBe("true");
  });

  it("names the service the overview opened, once it has opened one", () => {
    renderToolbar();
    expect(screen.getByRole("button", { name: "Show overview" })).toBeDefined();

    act(() => api!.setRevealed({ uuid: "m1", label: "Map" }));
    expect(
      screen.getByRole("button", {
        name: "Back to overview, which opened Map",
      }),
    ).toBeDefined();
  });

  it("stands down while the view is the thing on screen", () => {
    renderToolbar();
    act(() => api!.show());
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("is offered and refused on a board with nothing on it yet", () => {
    renderToolbar(emptyBoard);
    const button = screen.getByRole("button", { name: "Show overview" });
    expect(button).toHaveProperty("disabled", true);

    fireEvent.click(button);
    expect(screen.getByTestId("visible").textContent).toBe("false");
  });

  it("does not offer a way back on a board it cannot show", () => {
    renderToolbar(emptyBoard);
    act(() => api!.setRevealed({ uuid: "m1", label: "Map" }));
    expect(screen.getByRole("button", { name: "Show overview" })).toBeDefined();
  });
});
