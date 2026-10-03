import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import ServiceFrame from "./ServiceFrame";
import { BoardCtx, type BoardContextState } from "hkp-frontend/src/BoardContext";
import BlockUseFrame, {
  usePanelBlockLock,
} from "hkp-frontend/src/runtime/ui/BlockUse";

vi.mock("./ServiceHeader", () => ({
  default: (props: any) => (
    <button
      type="button"
      data-read-only={String(!!props.readOnly)}
      onClick={props.onConfig}
    >
      open config
    </button>
  ),
}));

// The code editor is not what is under test; it says whether it is read-only.
vi.mock("hkp-frontend/src/components/shared/Editor/index", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return {
    default: forwardRef((props: any, ref) => {
      useImperativeHandle(ref, () => ({ getValue: () => props.value }));
      return <pre data-read-only={String(!!props.readOnly)}>{props.value}</pre>;
    }),
  };
});

function createService() {
  return {
    uuid: "svc-1",
    serviceId: "hookup.to/service/timer",
    serviceName: "Timer",
    app: {
      registerNotificationTarget: vi.fn(),
      unregisterNotificationTarget: vi.fn(),
      next: vi.fn(),
    },
    state: {},
    configure: vi.fn(async () => ({})),
    getConfiguration: vi.fn(async () => ({ periodicValue: 1 })),
  } as any;
}

function lockedPanel(container: HTMLElement) {
  return container.querySelector(".hkp-block-locked") as HTMLElement;
}

describe("ServiceFrame inside a use of a block", () => {
  it("takes the lock over: the body is out of reach, the configuration is shown read-only", async () => {
    const { container } = render(
      <BlockUseFrame address="svc-1" locked>
        <ServiceFrame service={createService()} onAction={vi.fn()}>
          <button type="button">body control</button>
        </ServiceFrame>
      </BlockUseFrame>,
    );

    expect(lockedPanel(container).hasAttribute("inert")).toBe(false);
    expect(
      screen.getByText("body control").closest("[inert]"),
    ).not.toBeNull();

    const header = screen.getByText("open config");
    expect(header.closest("[inert]")).toBeNull();
    expect(header.dataset.readOnly).toBe("true");

    fireEvent.click(header);
    const name = (await screen.findByLabelText(
      "Service name",
    )) as HTMLInputElement;
    expect(name.readOnly).toBe(true);
    const shown = await screen.findByText(/periodicValue/);
    expect(shown.dataset.readOnly).toBe("true");
    expect(screen.queryByRole("button", { name: "Apply Changes" })).toBeNull();
  });

  it("hands the lock on to a panel that takes it: its body is reachable, and it is told it is locked", () => {
    function SelfLockingPanel() {
      const locked = usePanelBlockLock();
      return (
        <button type="button" disabled={locked}>
          {locked ? "locked panel" : "open panel"}
        </button>
      );
    }
    render(
      <BlockUseFrame address="svc-1" locked>
        <ServiceFrame service={createService()} onAction={vi.fn()}>
          <SelfLockingPanel />
        </ServiceFrame>
      </BlockUseFrame>,
    );
    const panel = screen.getByText("locked panel");
    expect(panel.closest("[inert]")).toBeNull();
    expect((panel as HTMLButtonElement).disabled).toBe(true);
  });

  it("leaves a panel taking the lock unlocked outside a use", () => {
    function SelfLockingPanel() {
      return <span>{usePanelBlockLock() ? "locked panel" : "open panel"}</span>;
    }
    render(
      <ServiceFrame service={createService()} onAction={vi.fn()}>
        <SelfLockingPanel />
      </ServiceFrame>,
    );
    const panel = screen.getByText("open panel");
    expect(panel.closest("[inert]")).toBeNull();
  });

  it("leaves a panel without a frame locked whole", () => {
    const { container } = render(
      <BlockUseFrame address="svc-1" locked>
        <button type="button">bare control</button>
      </BlockUseFrame>,
    );
    expect(lockedPanel(container).hasAttribute("inert")).toBe(true);
  });

  it("leaves a frameless panel locked whole", () => {
    const { container } = render(
      <BlockUseFrame address="svc-1" locked>
        <ServiceFrame service={createService()} onAction={vi.fn()} frameless>
          <button type="button">frameless control</button>
        </ServiceFrame>
      </BlockUseFrame>,
    );
    expect(lockedPanel(container).hasAttribute("inert")).toBe(true);
  });

  it("is writable outside a block", () => {
    render(
      <ServiceFrame service={createService()} onAction={vi.fn()}>
        <button type="button">body control</button>
      </ServiceFrame>,
    );
    expect(screen.getByText("body control").closest("[inert]")).toBeNull();
    expect(screen.getByText("open config").dataset.readOnly).toBe("false");
  });
});

describe("the output plug of a use", () => {
  // A use shows its bar and not its panel, so the plug its frame draws has to
  // be drawn beside the bar — else what the use passes on is out of sight.
  const board = {
    linkage: {
      units: [],
      views: [],
      blocks: {
        definitions: {
          "": [{ id: "b", name: "B", serviceId: "sub-service", state: { pipeline: [] } }],
        },
        placed: [
          {
            key: "k",
            runtimeId: "rt",
            path: ["rt", { id: "svc-1" }],
            address: "svc-1",
            id: "svc-1",
            use: { block: "b", uuid: "svc-1" },
            document: "",
          },
        ],
      },
    },
  } as unknown as BoardContextState;

  it("is drawn beside the use's bar, within reach, while the plugs inside stay in the panel", () => {
    const { container } = render(
      <BoardCtx.Provider value={board}>
        <BlockUseFrame address="svc-1" runtimeId="rt">
          <ServiceFrame service={createService()} onAction={vi.fn()}>
            <ServiceFrame
              service={{ ...createService(), uuid: "svc-2" }}
              onAction={vi.fn()}
            >
              <span>inside</span>
            </ServiceFrame>
          </ServiceFrame>
        </BlockUseFrame>
      </BoardCtx.Provider>,
    );
    const slot = container.querySelector("[data-use-output]")!;
    const own = slot.querySelectorAll('[aria-label="Inspect output"]');
    expect(own).toHaveLength(1);
    expect(own[0].closest("[inert]")).toBeNull();

    // The service inside the use keeps its plug in its own (hidden) frame.
    const all = container.querySelectorAll('[aria-label="Inspect output"]');
    expect(all).toHaveLength(2);
    expect(lockedPanel(container).contains(all[1] === own[0] ? all[0] : all[1])).toBe(true);
  });
});
