import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import ServiceFrame from "./ServiceFrame";

const { headerRenderSpy } = vi.hoisted(() => ({
  headerRenderSpy: vi.fn(),
}));

vi.mock("./ServiceHeader", () => ({
  default: (props: any) => {
    headerRenderSpy(props);
    return (
      <div data-testid="service-header" data-bypass={String(props.bypass)} />
    );
  },
}));

function createService(initialBypass: boolean) {
  const app = {
    registerNotificationTarget: vi.fn(),
    unregisterNotificationTarget: vi.fn(),
    next: vi.fn(),
  };

  const service: any = {
    uuid: "svc-http-1",
    serviceId: "http-server-subservices",
    serviceName: "HttpServerSubservices",
    __descriptor: {
      serviceId: "http-server-subservices",
      serviceName: "HttpServerSubservices",
    },
    app,
    state: {
      bypass: initialBypass,
    },
    configure: vi.fn(async () => ({})),
  };

  return service;
}

describe("ServiceFrame bypass sync regression", () => {
  it("updates bypass prop when service.state.bypass changes", async () => {
    headerRenderSpy.mockClear();
    const service = createService(true);

    const { rerender } = render(
      <ServiceFrame service={service} onAction={vi.fn()}>
        <div>content</div>
      </ServiceFrame>,
    );

    expect(
      screen.getByTestId("service-header").getAttribute("data-bypass"),
    ).toBe("true");

    service.state.bypass = false;

    rerender(
      <ServiceFrame service={service} onAction={vi.fn()}>
        <div>content</div>
      </ServiceFrame>,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("service-header").getAttribute("data-bypass"),
      ).toBe("false");
    });
  });
});
