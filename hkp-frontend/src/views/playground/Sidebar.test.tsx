import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { BoardCtx, type BoardContextState } from "hkp-frontend/src/BoardContext";
import { FacadeViewProvider } from "../../facade/FacadeViewContext";
import Sidebar from "./Sidebar";

function boardContext(state: Partial<BoardContextState>): BoardContextState {
  return { runtimes: [], registry: {}, ...state } as BoardContextState;
}

function renderSidebar(
  state: Partial<BoardContextState>,
  withViewState = true,
) {
  const sidebar = <Sidebar />;
  return render(
    <BoardCtx.Provider value={boardContext(state)}>
      {withViewState ? (
        <FacadeViewProvider boardName="Demo">{sidebar}</FacadeViewProvider>
      ) : (
        sidebar
      )}
    </BoardCtx.Provider>,
  );
}

const withRuntime = {
  runtimes: [{ id: "ui", type: "browser" }],
} as unknown as Partial<BoardContextState>;

const withFacade = {
  ...withRuntime,
  facade: { panels: [] },
} as unknown as Partial<BoardContextState>;

function sidebarShown() {
  return screen.queryByText("Building Blocks") !== null;
}

describe("Sidebar", () => {
  // A board opens on its facade, so the stored layout decides the mode.
  beforeEach(() => localStorage.clear());

  it("is hidden on a facade board shown as the facade alone", () => {
    renderSidebar(withFacade);
    expect(sidebarShown()).toBe(false);
  });

  it("is shown beside the board", () => {
    localStorage.setItem("hkp-facade-runtime-Demo", "true");
    renderSidebar(withFacade);
    expect(sidebarShown()).toBe(true);
  });

  it("is shown on a board that has no facade to fill the window", () => {
    renderSidebar(withRuntime);
    expect(sidebarShown()).toBe(true);
  });

  it("is shown where no view state is mounted", () => {
    renderSidebar(withFacade, false);
    expect(sidebarShown()).toBe(true);
  });
});
