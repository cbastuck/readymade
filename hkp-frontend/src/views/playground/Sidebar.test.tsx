import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import {
  BoardCtx,
  type BoardContextState,
} from "hkp-frontend/src/BoardContext";
import { FacadeViewProvider } from "../../facade/FacadeViewContext";
import SelectionCtx from "../../selection/SelectionContext";
import Sidebar from "./Sidebar";

function boardContext(state: Partial<BoardContextState>): BoardContextState {
  return { runtimes: [], registry: {}, ...state } as BoardContextState;
}

function renderSidebar(
  state: Partial<BoardContextState>,
  withViewState = true,
  selectedRuntimeId: string | null = null,
) {
  const sidebar = (
    <SelectionCtx.Provider
      value={{ selectedRuntimeId, selectRuntime: vi.fn() }}
    >
      <Sidebar />
    </SelectionCtx.Provider>
  );
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

// A board whose two runtimes put their services in two palette groups, which
// is the arrangement a person has to scroll through.
const withTwoRuntimes = {
  runtimes: [
    { id: "ui", name: "Browser Runtime 1", type: "browser" },
    { id: "node", name: "NodeJS 2", type: "rest" },
  ],
  registry: {
    ui: [{ serviceId: "hookup.to/service/timer", serviceName: "Timer" }],
    node: [{ serviceId: "monitor", serviceName: "Monitor" }],
  },
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

  describe("selected runtime", () => {
    // jsdom lays nothing out and has no scrollTo of its own, so the palette's
    // scroll is observed by standing one in for it.
    const scrollTo = vi.fn();
    beforeEach(() => {
      scrollTo.mockClear();
      (Element.prototype as any).scrollTo = scrollTo;
    });
    afterEach(() => {
      delete (Element.prototype as any).scrollTo;
    });

    it("scrolls to its services when they are out of view", () => {
      renderSidebar(withTwoRuntimes, true, "node");

      expect(scrollTo).toHaveBeenCalled();
    });

    it("marks the group its services are in", () => {
      renderSidebar(withTwoRuntimes, true, "node");

      expect(screen.getByTitle("Services for NodeJS 2").textContent).toContain(
        "REST",
      );
    });

    it("marks no group while nothing is selected", () => {
      renderSidebar(withTwoRuntimes);

      expect(screen.queryByTitle(/^Services for /)).toBeNull();
    });

    it("folds away the services it cannot run", () => {
      renderSidebar(withTwoRuntimes, true, "node");

      expect(screen.getByText("Monitor")).not.toBeNull();
      expect(screen.queryByText("Timer")).toBeNull();
    });

    it("says how many a folded group matched while searching", () => {
      renderSidebar(withTwoRuntimes, true, "node");

      // "r" is in both service names, so the browser group has a match to
      // report from behind its header.
      fireEvent.change(screen.getByPlaceholderText("Search…"), {
        target: { value: "r" },
      });

      expect(screen.queryByText("Timer")).toBeNull();
      expect(screen.getByTitle("1 more in Browser")).not.toBeNull();
    });

    it("unfolds the rest when the search finds nothing it can run", () => {
      renderSidebar(withTwoRuntimes, true, "node");

      fireEvent.change(screen.getByPlaceholderText("Search…"), {
        target: { value: "tim" },
      });

      expect(screen.getByText("Timer")).not.toBeNull();
    });

    it("opens the group again when it was collapsed", () => {
      const { rerender } = renderSidebar(withTwoRuntimes);

      fireEvent.click(screen.getByText("REST"));
      expect(screen.queryByText("Monitor")).toBeNull();

      rerender(
        <BoardCtx.Provider value={boardContext(withTwoRuntimes)}>
          <FacadeViewProvider boardName="Demo">
            <SelectionCtx.Provider
              value={{ selectedRuntimeId: "node", selectRuntime: vi.fn() }}
            >
              <Sidebar />
            </SelectionCtx.Provider>
          </FacadeViewProvider>
        </BoardCtx.Provider>,
      );

      expect(screen.getByText("Monitor")).not.toBeNull();
    });
  });
});
