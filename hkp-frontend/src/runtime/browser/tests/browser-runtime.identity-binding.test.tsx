import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

import BrowserRuntime from "../BrowserRuntime";

const capturedProps: Array<{ services: any[] }> = [];

vi.mock("hkp-frontend/src/runtime/ServiceUiContainer", () => ({
  default: (props: { services: any[] }) => {
    capturedProps.push({ services: props.services });
    return <div data-testid="service-ui-container" />;
  },
}));

vi.mock("hkp-frontend/src/runtime/browser/BrowserRuntimeApi", () => ({
  removeRuntime: vi.fn(),
}));

describe("BrowserRuntime service identity binding", () => {
  beforeEach(() => {
    capturedProps.length = 0;
  });

  it("preserves service instance identity while applying descriptor serviceName", () => {
    const instance = {
      uuid: "svc-1",
      serviceId: "hookup.to/service/timer",
      serviceName: "Original Name",
      app: {},
      configure: vi.fn(),
      process: vi.fn(),
      getConfiguration: vi.fn(async () => ({})),
      destroy: vi.fn(),
    } as any;

    const scope = {
      descriptor: { id: "rt-1", type: "browser", name: "Browser Runtime" },
      authenticatedUser: null,
      findServiceInstance: vi.fn(() => [instance]),
      registry: { findServiceModule: vi.fn(() => null) },
      onResult: undefined,
      processRuntimeByName: undefined,
      onAction: () => false,
    } as any;

    const commonProps = {
      scope,
      runtime: { id: "rt-1", type: "browser", name: "Browser Runtime" } as any,
      user: null,
      boardName: "board-1",
      onArrangeService: vi.fn(),
      onServiceAction: vi.fn(),
      onResult: vi.fn(),
      processRuntimeByName: vi.fn(),
    };

    const { rerender } = render(
      <BrowserRuntime
        {...commonProps}
        services={[{ uuid: "svc-1", serviceName: "Renamed A" } as any]}
      />,
    );

    const firstRef = capturedProps[0].services[0];
    expect(firstRef).toBe(instance);
    expect(firstRef.serviceName).toBe("Renamed A");

    rerender(
      <BrowserRuntime
        {...commonProps}
        services={[{ uuid: "svc-1", serviceName: "Renamed B" } as any]}
      />,
    );

    const secondRef = capturedProps[1].services[0];
    expect(secondRef).toBe(instance);
    expect(secondRef.serviceName).toBe("Renamed B");
    expect(scope.findServiceInstance).toHaveBeenCalledWith("svc-1");
  });
});
