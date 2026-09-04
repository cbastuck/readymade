import { describe, expect, it, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";

import {
  FacadeViewProvider,
  useFacadeView,
  type FacadeViewApi,
} from "../FacadeViewContext";

let api: FacadeViewApi | null;

function Probe() {
  api = useFacadeView();
  return (
    <span data-testid="state">
      {api?.mode}:{String(api?.showFacade)}:{String(api?.showRuntime)}
    </span>
  );
}

function renderProvider(boardName = "Demo") {
  return render(
    <FacadeViewProvider boardName={boardName}>
      <Probe />
    </FacadeViewProvider>,
  );
}

describe("FacadeViewProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    api = null;
  });

  it("shows the facade alone on a board that has never been switched", () => {
    renderProvider();
    expect(screen.getByTestId("state").textContent).toBe("facade:true:false");
  });

  it("gives each mode the two flags the layout is drawn from", () => {
    renderProvider();

    act(() => api!.setMode("split"));
    expect(screen.getByTestId("state").textContent).toBe("split:true:true");

    act(() => api!.setMode("board"));
    expect(screen.getByTestId("state").textContent).toBe("board:false:true");
  });

  it("reads back a layout stored as the two separate flags it used to be", () => {
    localStorage.setItem("hkp-facade-visible-Demo", "true");
    localStorage.setItem("hkp-facade-runtime-Demo", "true");
    renderProvider();
    expect(screen.getByTestId("state").textContent).toBe("split:true:true");
  });

  it("resolves a stored pair that shows neither half to the board", () => {
    localStorage.setItem("hkp-facade-visible-Demo", "false");
    localStorage.setItem("hkp-facade-runtime-Demo", "false");
    renderProvider();
    expect(screen.getByTestId("state").textContent).toBe("board:false:true");
  });

  it("picks the layout up once the board it belongs to is known", () => {
    localStorage.setItem("hkp-facade-visible-Later", "false");
    const { rerender } = renderProvider("");
    expect(screen.getByTestId("state").textContent).toBe("facade:true:false");

    rerender(
      <FacadeViewProvider boardName="Later">
        <Probe />
      </FacadeViewProvider>,
    );
    expect(screen.getByTestId("state").textContent).toBe("board:false:true");
  });

  it("opens and closes the editor without remembering it", () => {
    renderProvider();
    expect(api!.editorOpen).toBe(false);
    act(() => api!.toggleEditor());
    expect(api!.editorOpen).toBe(true);
  });
});

describe("useFacadeView", () => {
  it("is null where no provider is mounted", () => {
    render(<Probe />);
    expect(api).toBe(null);
  });
});
