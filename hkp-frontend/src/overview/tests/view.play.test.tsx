import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { BoardCtx, BoardContextState } from "hkp-frontend/src/BoardContext";
import { OverviewProvider, useOverview } from "../OverviewContext";
import OverviewView from "../OverviewView";

beforeAll(() => {
  // There is no 2D context in here, and the view already draws nothing when it
  // cannot get one. Saying so plainly keeps jsdom from reporting it as a fault.
  HTMLCanvasElement.prototype.getContext = () => null;
});

beforeEach(() => {
  localStorage.clear();
});

/**
 * The overview is switched to in the toolbar, and its one choice of its own —
 * the layout — floats over the view, so the toolbar is the same either way.
 * Nothing is drawn in here — that needs a browser — so this is about the
 * control and the keys.
 */

let api: ReturnType<typeof useOverview>;
function Probe() {
  api = useOverview();
  return null;
}

function renderOverview() {
  const boardContext = {
    boardName: "Test Board",
    runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
    services: { ui: [{ uuid: "timer", serviceId: "timer" }] },
    scopes: { ui: { id: "ui" } },
    runtimeApis: {},
  } as unknown as BoardContextState;

  render(
    <BoardCtx.Provider value={boardContext}>
      <OverviewProvider>
        <Probe />
        {/* Mounted where the board is, as BoardEntryPoint mounts it. */}
        <OverviewShown />
      </OverviewProvider>
    </BoardCtx.Provider>,
  );
}

function OverviewShown() {
  return useOverview()?.visible ? <OverviewView /> : null;
}

const sideBySide = () => screen.getByLabelText("Lay nested pipelines side by side");
const stacked = () => screen.getByLabelText("Stack nested pipelines below their host");

describe("the overview's layout control, on the view", () => {
  it("is only there while the overview is on", () => {
    renderOverview();
    expect(screen.queryByLabelText("Lay nested pipelines side by side")).toBeNull();

    act(() => api!.show());
    expect(sideBySide().getAttribute("aria-pressed")).toBe("true");
    expect(stacked().getAttribute("aria-pressed")).toBe("false");
  });

  it("switches layout, and remembers the choice for next time", () => {
    renderOverview();
    act(() => api!.show());

    fireEvent.click(stacked());
    expect(stacked().getAttribute("aria-pressed")).toBe("true");
    expect(api!.layout).toBe("stacked");
    expect(localStorage.getItem("hkp-overview-layout")).toBe("stacked");
  });

  it("opens in the layout last chosen", () => {
    localStorage.setItem("hkp-overview-layout", "stacked");
    renderOverview();
    act(() => api!.show());
    expect(stacked().getAttribute("aria-pressed")).toBe("true");
  });
});

describe("the overview's keys", () => {
  it("leaves switching back to the toolbar: Escape does not close it", () => {
    renderOverview();
    act(() => api!.show());
    expect(document.querySelector("canvas")).not.toBeNull();

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(api!.visible).toBe(true);
    expect(document.querySelector("canvas")).not.toBeNull();
  });
});
