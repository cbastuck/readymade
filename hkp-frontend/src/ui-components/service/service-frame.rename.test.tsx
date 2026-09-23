import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import ServiceFrame from "./ServiceFrame";

vi.mock("./ServiceHeader", () => ({
  default: (props: any) => (
    <button type="button" onClick={props.onConfig}>
      open config
    </button>
  ),
}));

// The code editor is not what is under test; it answers with the config as is.
vi.mock("hkp-frontend/src/components/shared/Editor/index", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return {
    default: forwardRef((props: any, ref) => {
      useImperativeHandle(ref, () => ({ getValue: () => props.value }));
      return <pre>{props.value}</pre>;
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

async function openDialog() {
  fireEvent.click(screen.getByText("open config"));
  return screen.findByLabelText("Service name");
}

describe("ServiceFrame configuration dialog", () => {
  it("renames the service when the configuration is applied", async () => {
    const service = createService();
    const onAction = vi.fn();
    render(
      <ServiceFrame service={service} onAction={onAction}>
        <div />
      </ServiceFrame>,
    );

    const input = (await openDialog()) as HTMLInputElement;
    expect(input.value).toBe("Timer");
    await screen.findByText(/periodicValue/);

    fireEvent.change(input, { target: { value: "  Heartbeat  " } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Changes" }));

    expect(onAction).toHaveBeenCalledWith({
      action: "rename",
      service,
      payload: { value: "Heartbeat" },
    });
    await waitFor(() => expect(service.configure).toHaveBeenCalled());
  });

  it("renames on Enter in the name field", async () => {
    const onAction = vi.fn();
    render(
      <ServiceFrame service={createService()} onAction={onAction}>
        <div />
      </ServiceFrame>,
    );

    const input = await openDialog();
    fireEvent.change(input, { target: { value: "Heartbeat" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { value: "Heartbeat" } }),
    );
  });

  it("does not rename when the name is unchanged or empty", async () => {
    const onAction = vi.fn();
    render(
      <ServiceFrame service={createService()} onAction={onAction}>
        <div />
      </ServiceFrame>,
    );

    const input = await openDialog();
    await screen.findByText(/periodicValue/);
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Changes" }));

    expect(onAction).not.toHaveBeenCalled();
  });
});
