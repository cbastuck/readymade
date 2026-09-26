import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import ServiceFrame from "./ServiceFrame";
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
