import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import {
  BoardCtx,
  type BoardContextState,
} from "hkp-frontend/src/BoardContext";
import { FacadeViewProvider } from "../../facade/FacadeViewContext";
import SelectionCtx from "../../selection/SelectionContext";
import Sidebar from "./Sidebar";
import { parsePreset, savePreset } from "../../core/presets";
import { HKP_DND_SERVICE_CLASS_TYPE } from "../../components/DropTypes";

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

// A runtime that can host a sub-service is a runtime a composed preset can be
// dropped onto.
const withSubService = {
  runtimes: [{ id: "ui", name: "Browser Runtime", type: "browser" }],
  registry: {
    ui: [
      { serviceId: "hookup.to/service/timer", serviceName: "Timer" },
      { serviceId: "sub-service", serviceName: "SubService" },
    ],
  },
} as unknown as Partial<BoardContextState>;

const COMPOSED_PRESET = {
  preset: "v1",
  id: "telegram-responder",
  name: "Telegram responder",
  serviceId: "sub-service",
  serviceName: "Telegram responder",
  description: "Answers a Telegram message with a reply",
  state: { pipeline: [{ serviceId: "timer", instanceId: "t", state: {} }] },
};

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

describe("composed presets in the palette", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it("offers a sub-service preset as a card of its own", () => {
    savePreset(parsePreset(COMPOSED_PRESET));
    renderSidebar(withSubService);

    // A building block made of services sits in the palette beside the
    // primitives, under its own name rather than the sub-service's.
    expect(screen.getByText("Telegram responder")).toBeTruthy();
    expect(screen.getByText("SubService")).toBeTruthy();
  });

  it("is named after the preset even when it was captured from a service", () => {
    // A preset saved from a service carries that service's name in
    // `serviceName` — which for a sub-service is "SubService", and would put a
    // second card called "SubService" beside the primitive it came from.
    savePreset(parsePreset({ ...COMPOSED_PRESET, serviceName: "SubService" }));
    renderSidebar(withSubService);

    expect(screen.getAllByText("SubService")).toHaveLength(1);
    expect(screen.getByText("Telegram responder")).toBeTruthy();
  });

  it("drags as the sub-service, carrying which preset to configure it from", () => {
    savePreset(parsePreset(COMPOSED_PRESET));
    renderSidebar(withSubService);

    const card = screen
      .getByText("Telegram responder")
      .closest(".hkp-palette-card")!;
    const data: Record<string, string> = {};
    fireEvent.dragStart(card, {
      dataTransfer: {
        setData: (type: string, value: string) => {
          data[type] = value;
        },
      },
    });

    const payload = JSON.parse(data[HKP_DND_SERVICE_CLASS_TYPE]);
    expect(payload.serviceId).toBe("sub-service");
    expect(payload.serviceName).toBe("Telegram responder");
    expect(payload.preset).toEqual({
      id: "telegram-responder",
      serviceId: "sub-service",
    });
  });

  it("offers nothing where the runtime has no sub-service to put it in", () => {
    savePreset(parsePreset(COMPOSED_PRESET));
    renderSidebar(withRuntime);

    expect(screen.queryByText("Telegram responder")).toBeNull();
  });

  it("respects the runtimes a preset says it is meant for", () => {
    // A composed preset names its nested services by ids one registry has and
    // another may not, so where it belongs is the author's to say.
    savePreset(parsePreset({ ...COMPOSED_PRESET, runtimes: ["rest"] }));
    renderSidebar(withSubService);

    expect(screen.queryByText("Telegram responder")).toBeNull();
  });
});

describe("the runtimes / services splitter", () => {
  beforeEach(() => localStorage.clear());

  it("keeps the height a drag left the runtimes pane at", () => {
    renderSidebar(withTwoRuntimes);

    const splitter = screen.getByRole("separator");
    fireEvent.pointerDown(splitter, { clientY: 100 });
    fireEvent.pointerMove(window, { clientY: 260 });
    fireEvent.pointerUp(window);

    // jsdom lays nothing out, so every height clamps to the minimum — what is
    // under test is that the drag settles on one and writes it down.
    expect(localStorage.getItem("hkp-sidebar-runtimes-height")).not.toBeNull();
  });

  it("gives the pane back its own sizing on a double-click", () => {
    localStorage.setItem("hkp-sidebar-runtimes-height", "180");
    renderSidebar(withTwoRuntimes);

    fireEvent.doubleClick(screen.getByRole("separator"));

    expect(localStorage.getItem("hkp-sidebar-runtimes-height")).toBeNull();
  });
});

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
