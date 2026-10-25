import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import BrowserSubServiceUI from "../BrowserSubServiceUI";
import BlockUseFrame from "hkp-frontend/src/runtime/ui/BlockUse";
import NestedNavProvider from "hkp-frontend/src/runtime/ui/NestedNavigation";
import { ServiceInstance } from "hkp-frontend/src/types";

/**
 * A sub-service drawn inside a use of a block can still be looked into.
 *
 * Its inside belongs to the block, so nothing in the panel that writes may be
 * reached — but folding its pipeline open and opening it as a level only
 * read. Left locked whole, the panel's own buttons did nothing and the frame
 * drew a second open button above the panel to make up for it.
 */

function scope(): ServiceInstance {
  return {
    uuid: "inner",
    serviceId: "sub-service",
    serviceName: "Timer + 2 more",
    state: {
      stopPropagation: false,
      scope: { slots: "inherit" },
      pipeline: [{ serviceId: "monitor", instanceId: "m1" }],
    },
    configure: vi.fn(),
    getConfiguration: vi.fn(async () => ({})),
    app: {
      registerNotificationTarget: vi.fn(),
      unregisterNotificationTarget: vi.fn(),
      listAvailableServices: () => [
        { serviceId: "monitor", serviceName: "Monitor" },
      ],
    },
  } as unknown as ServiceInstance;
}

function renderInsideUse() {
  return render(
    <NestedNavProvider rootLabel="Board">
      <BlockUseFrame
        address="outer.inner"
        locked
        level={{ id: "inner", label: "Timer + 2 more" }}
      >
        <BrowserSubServiceUI service={scope()} onServiceAction={vi.fn()} />
      </BlockUseFrame>
    </NestedNavProvider>,
  );
}

describe("a sub-service inside a use of a block", () => {
  it("offers one way onto its level, and it opens the level", () => {
    renderInsideUse();

    const open = screen.getAllByTitle("Open Timer + 2 more as its own level");
    expect(open).toHaveLength(1);
    expect(open[0].closest("[inert]")).toBeNull();

    fireEvent.click(open[0]);
    expect(
      screen.getByRole("navigation", { name: "Nested pipeline" }),
    ).toBeTruthy();
  });

  it("folds its pipeline open in place", () => {
    renderInsideUse();

    const fold = screen.getByTitle("Show content inline");
    expect(fold.closest("[inert]")).toBeNull();
    fireEvent.click(fold);
    expect(screen.getByTitle("Hide inline content")).toBeTruthy();
  });

  it("shows the scope's declarations without offering to change them", () => {
    renderInsideUse();

    expect(screen.getByText("continues")).toBeTruthy();
    expect(screen.getByText("inherit")).toBeTruthy();
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  });
});
