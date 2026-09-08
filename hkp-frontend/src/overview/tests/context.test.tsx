import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";

import {
  OverviewProvider,
  useOverview,
} from "../OverviewContext";

let api: ReturnType<typeof useOverview>;

function Probe() {
  api = useOverview();
  return (
    <span data-testid="state">
      {String(api?.visible)}:{api?.revealed?.label ?? "none"}
    </span>
  );
}

function renderProvider() {
  return render(
    <OverviewProvider>
      <Probe />
    </OverviewProvider>,
  );
}

describe("OverviewProvider", () => {
  it("remembers what the overview was used to open", () => {
    renderProvider();
    act(() => api!.setRevealed({ uuid: "svc-1", label: "Timer" }));
    expect(screen.getByTestId("state").textContent).toBe("false:Timer");
  });

  it("forgets it once the overview is on screen again", () => {
    renderProvider();
    act(() => api!.setRevealed({ uuid: "svc-1", label: "Timer" }));
    act(() => api!.show());
    expect(screen.getByTestId("state").textContent).toBe("true:none");
  });

  it("forgets it when toggled back open, and not when toggled shut", () => {
    renderProvider();
    act(() => api!.setRevealed({ uuid: "svc-1", label: "Timer" }));

    act(() => api!.toggle());
    expect(screen.getByTestId("state").textContent).toBe("true:none");

    act(() => api!.setRevealed({ uuid: "svc-2", label: "Monitor" }));
    act(() => api!.toggle());
    expect(screen.getByTestId("state").textContent).toBe("false:Monitor");
  });
});
