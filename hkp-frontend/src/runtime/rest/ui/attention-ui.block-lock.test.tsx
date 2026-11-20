import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import AttentionUI from "./AttentionUI";
import BlockUseFrame from "hkp-frontend/src/runtime/ui/BlockUse";

vi.mock("hkp-frontend/src/ui-components/service/ServiceHeader", () => ({
  default: () => <div>header</div>,
}));

function createService() {
  return {
    uuid: "attention",
    serviceId: "attention",
    serviceName: "Attention",
    app: {
      registerNotificationTarget: vi.fn(),
      unregisterNotificationTarget: vi.fn(),
      next: vi.fn(),
    },
    state: {
      status: "ready",
      layer: 3,
      heads: 2,
      head: 0,
      mask: "causal",
      pieces: ["a", "b"],
      pattern: [
        [1, 0],
        [0.4, 0.6],
      ],
    },
    configure: vi.fn(async () => ({})),
    getConfiguration: vi.fn(async () => ({})),
  } as any;
}

describe("the attention panel inside a use of a block", () => {
  // What is inside a use belongs to its definition: what changes the layer's
  // computation is set on the use's bar. Which head is shown changes nothing
  // the layer hands on, so the panel keeps that in reach.
  it("locks what changes the layer and keeps the pattern and the head picker", () => {
    render(
      <BlockUseFrame address="attention" locked>
        <AttentionUI service={createService()} />
      </BlockUseFrame>,
    );
    const switchOff = screen.getByRole("button", { name: "Switch head 0 off" });
    expect((switchOff as HTMLButtonElement).disabled).toBe(true);
    expect(switchOff.closest("[inert]")).toBeNull();
    expect(screen.getByText(/set on the use's bar/)).toBeTruthy();

    const comboboxes = screen.getAllByRole("combobox") as HTMLButtonElement[];
    // Mask, then Head.
    expect(comboboxes).toHaveLength(2);
    expect(comboboxes[0].disabled).toBe(true);
    expect(comboboxes[1].disabled).toBe(false);

    expect(screen.getByTestId("heatmap-cell-1-1")).toBeTruthy();
  });

  it("leaves everything in reach outside a use", () => {
    render(<AttentionUI service={createService()} />);
    const switchOff = screen.getByRole("button", { name: "Switch head 0 off" });
    expect((switchOff as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/set on the use's bar/)).toBeNull();
    for (const box of screen.getAllByRole("combobox") as HTMLButtonElement[]) {
      expect(box.disabled).toBe(false);
    }
  });
});
