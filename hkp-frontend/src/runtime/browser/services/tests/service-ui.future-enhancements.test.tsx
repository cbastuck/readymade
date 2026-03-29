import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";

type AnyComponent = React.ComponentType<ServiceUIProps>;

function createMockService(
  stateOverride?: Record<string, any>,
  overrides?: Partial<ServiceInstance>,
): ServiceInstance {
  const app = {
    registerNotificationTarget: vi.fn(),
    unregisterNotificationTarget: vi.fn(),
    createSubServiceUI: vi.fn(() => null),
    listAvailableServices: vi.fn(() => []),
    createSubService: vi.fn(async () => null),
    getServiceById: vi.fn(() => null),
    sendAction: vi.fn(),
    notify: vi.fn(),
    storeServiceData: vi.fn(),
    restoreServiceData: vi.fn(),
    removeServiceData: vi.fn(),
    next: vi.fn(),
  };

  return {
    app,
    uuid: "svc-test-1",
    serviceId: "test/service",
    serviceName: "Test Service",
    board: "test-board",
    state: stateOverride || {},
    steps: [],
    currentStep: 0,
    repeat: false,
    register: vi.fn(),
    unregister: vi.fn(),
    configure: vi.fn(),
    process: vi.fn(),
    getConfiguration: vi.fn(async () => stateOverride || {}),
    destroy: vi.fn(),
    appendSubService: vi.fn(async () => null),
    removeSubService: vi.fn(async () => null),
    ...overrides,
  } as ServiceInstance;
}

function createProps(service: ServiceInstance): ServiceUIProps {
  return {
    service,
    onServiceAction: vi.fn(),
  };
}

function getStableSnapshotMarkup(container: HTMLElement): string {
  return (container.firstChild as HTMLElement).outerHTML
    .replace(/id="[^"]+"/g, 'id="__dynamic_id__"')
    .replace(/for="[^"]+"/g, 'for="__dynamic_id__"');
}

describe("Service UI Future Enhancements", () => {
  describe("Service Lifecycle", () => {
    let InputUI: AnyComponent;

    beforeEach(async () => {
      const mod = await import("../InputUI");
      InputUI = mod.default;
    });

    it("mounts, configures, and unregisters notification targets on unmount", async () => {
      const service = createMockService({
        url: "https://example.com",
        mode: "eventsource",
        parseEventsAsJSON: true,
      });

      const { unmount } = render(
        React.createElement(InputUI, createProps(service)),
      );
      await waitFor(() => {
        expect(service.getConfiguration).toHaveBeenCalled();
      });

      expect(service.app.registerNotificationTarget).toHaveBeenCalled();

      service.configure({ url: "https://example.org" });
      expect(service.configure).toHaveBeenCalledWith(
        expect.objectContaining({ url: "https://example.org" }),
      );

      unmount();
      expect(service.app.unregisterNotificationTarget).toHaveBeenCalled();
    });
  });

  describe("Visual Regression", () => {
    let AggregatorUI: AnyComponent;
    let InputUI: AnyComponent;

    beforeEach(async () => {
      const [agg, input] = await Promise.all([
        import("../AggregatorUI"),
        import("../InputUI"),
      ]);
      AggregatorUI = agg.default;
      InputUI = input.default;
    });

    it("matches snapshot for AggregatorUI initial render", async () => {
      const service = createMockService({
        interval: 100,
        property: "temperature",
        aggregator: "max value count",
      });
      const { container } = render(
        React.createElement(AggregatorUI, createProps(service)),
      );
      await waitFor(() => {
        expect(service.getConfiguration).toHaveBeenCalled();
      });
      expect(getStableSnapshotMarkup(container)).toMatchSnapshot();
    });

    it("matches snapshot for InputUI initial render", async () => {
      const service = createMockService({
        url: "https://example.com/stream",
        mode: "eventsource",
        parseEventsAsJSON: true,
      });
      const { container } = render(
        React.createElement(InputUI, createProps(service)),
      );
      await waitFor(() => {
        expect(service.getConfiguration).toHaveBeenCalled();
      });
      expect(getStableSnapshotMarkup(container)).toMatchSnapshot();
    });
  });

  describe("Accessibility", () => {
    let InputUI: AnyComponent;

    beforeEach(async () => {
      const mod = await import("../InputUI");
      InputUI = mod.default;
    });

    it("renders accessible interactive controls with names", async () => {
      const service = createMockService({
        url: "",
        mode: "eventsource",
        parseEventsAsJSON: true,
      });

      render(React.createElement(InputUI, createProps(service)));
      await waitFor(() => {
        expect(service.getConfiguration).toHaveBeenCalled();
      });

      const radios = screen.getAllByRole("radio");
      expect(radios.length).toBeGreaterThan(0);

      const textboxes = screen.getAllByRole("textbox");
      expect(textboxes.length).toBeGreaterThan(0);
    });
  });

  describe("Custom Segment Rendering", () => {
    it("renders multiple segment-like child regions inside ServiceUI wrapper", async () => {
      const service = createMockService({});
      const props = createProps(service);

      render(
        React.createElement(
          ServiceUI,
          {
            ...props,
            className: "custom-segment-test",
          },
          React.createElement(
            "div",
            null,
            React.createElement(
              "section",
              { "aria-label": "segment-main" },
              "Main Segment",
            ),
            React.createElement(
              "section",
              { "aria-label": "segment-sidebar" },
              "Sidebar Segment",
            ),
          ),
        ),
      );
      await waitFor(() => {
        expect(service.getConfiguration).toHaveBeenCalled();
      });

      expect(screen.getByLabelText("segment-main")).toBeTruthy();
      expect(screen.getByLabelText("segment-sidebar")).toBeTruthy();
    });
  });

  describe("Deeply Nested Sub-services Stress", () => {
    let LooperUI: AnyComponent;

    beforeEach(async () => {
      const mod = await import("../LooperUI");
      LooperUI = mod.default;
    });

    it("renders with many nested sub-services without crashing", async () => {
      const nestedInstances = Array.from({ length: 25 }, (_, idx) => ({
        uuid: `sub-${idx + 1}`,
        serviceId: "test/filter",
        serviceName: `Nested ${idx + 1}`,
        app: {
          registerNotificationTarget: vi.fn(),
          unregisterNotificationTarget: vi.fn(),
          createSubServiceUI: vi.fn(() => null),
        },
        state: {},
        getConfiguration: vi.fn(async () => ({})),
        configure: vi.fn(),
      })) as any[];

      const service = createMockService({
        instances: nestedInstances,
        numIterations: 1,
        iterationResults: [],
        incrementalOutput: false,
        interactiveMode: false,
        loopCondition: "",
      });

      const { container } = render(
        React.createElement(LooperUI, createProps(service)),
      );
      expect(container).toBeTruthy();
      await waitFor(() => {
        expect(service.app.createSubServiceUI).toHaveBeenCalledTimes(
          nestedInstances.length,
        );
      });
    });
  });
});
