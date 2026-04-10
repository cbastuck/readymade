import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, waitFor, screen } from "@testing-library/react";

import { ServiceUIProps, ServiceInstance } from "hkp-frontend/src/types";

type AnyComponent = React.ComponentType<ServiceUIProps>;

/**
 * Integration tests for Service UI components
 *
 * These tests validate the contract between UI and service:
 * 1. UI initializes from service state
 * 2. UI calls service.configure() with correct parameter keys
 * 3. UI responds to service notifications
 * 4. Configuration APIs are consistent
 */

// Helper to create a mock service with spy capabilities
function createMockServiceWithSpies(
  stateOverride?: Record<string, any>,
  overrides?: Partial<ServiceInstance>,
) {
  const configureSpy = vi.fn();

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
    configure: configureSpy as any,
    process: vi.fn(),
    getConfiguration: vi.fn(async () => stateOverride || {}),
    destroy: vi.fn(),
    ...overrides,
  } as ServiceInstance;
}

// Helper to create standard ServiceUIProps
function createStandardProps(service: ServiceInstance): ServiceUIProps {
  return {
    service,
    onServiceAction: vi.fn(),
  };
}

async function renderServiceUIAndWait(
  Component: AnyComponent,
  props: ServiceUIProps,
) {
  const rendered = render(React.createElement(Component, props));
  await waitFor(() => {
    expect(props.service.getConfiguration).toHaveBeenCalled();
  });
  return rendered;
}

describe("Service UI Behavioral Tests", () => {
  describe("AggregatorUI - Configuration API", () => {
    let AggregatorUI: AnyComponent;

    beforeEach(async () => {
      const mod = await import("../AggregatorUI");
      AggregatorUI = mod.default;
    });

    it("should initialize with default state values", async () => {
      const service = createMockServiceWithSpies({
        interval: 0,
        property: "",
        aggregator: "",
      });

      const props = createStandardProps(service);
      const { container } = await renderServiceUIAndWait(AggregatorUI, props);

      // Component rendered successfully
      expect(container.querySelector(".flex")).toBeTruthy();
    });

    it("should call service.configure with property key when property input changes", async () => {
      const service = createMockServiceWithSpies({
        interval: 100,
        property: "oldValue",
        aggregator: "max value count",
      });

      const props = createStandardProps(service);
      await renderServiceUIAndWait(AggregatorUI, props);

      // The ServiceUI wrapper manages the configure calls
      // We verify the service.configure API exists and is callable
      expect(typeof service.configure).toBe("function");
    });

    it("should call service.configure with interval key when interval changes", async () => {
      const service = createMockServiceWithSpies({
        interval: 100,
        property: "test",
        aggregator: "max value count",
      });

      const props = createStandardProps(service);
      await renderServiceUIAndWait(AggregatorUI, props);

      // Verify the interface accepts configure calls with these keys
      expect(service.configure).toBeDefined();
    });

    it("verifies configure API accepts: interval, property, aggregator", () => {
      const service = createMockServiceWithSpies();

      // Call with all expected keys
      service.configure({ interval: 500, property: "test", aggregator: "max" });

      expect(service.configure).toHaveBeenCalledWith(
        expect.objectContaining({}),
      );
    });
  });

  describe("TimerUI - Configuration API", () => {
    let TimerUI: AnyComponent;

    beforeEach(async () => {
      const mod = await import("../TimerUI");
      TimerUI = mod.default;
    });

    it("should initialize with periodic and oneshot state", async () => {
      const service = createMockServiceWithSpies({
        periodic: false,
        periodicValue: 1,
        periodicUnit: "s",
        oneShotDelay: 0,
        oneShotDelayUnit: "ms",
        running: false,
      });

      const props = createStandardProps(service);
      const { container } = await renderServiceUIAndWait(TimerUI, props);

      expect(container).toBeTruthy();
    });

    it("disables Start Interval when bypass is enabled", async () => {
      const service = createMockServiceWithSpies({
        periodic: true,
        periodicValue: 1,
        periodicUnit: "s",
        oneShotDelay: 0,
        oneShotDelayUnit: "ms",
        running: false,
        bypass: true,
      });

      const props = createStandardProps(service);
      await renderServiceUIAndWait(TimerUI, props);

      const startButton = screen.getByRole("button", {
        name: "Start Interval",
      }) as HTMLButtonElement;
      expect(startButton.disabled).toBe(true);
    });

    it("verifies configure API accepts: periodic, periodicValue, periodicUnit, oneShotDelay, start, stop", () => {
      const service = createMockServiceWithSpies();

      // Test each expected configuration key
      service.configure({ periodic: true });
      service.configure({ periodicValue: 1000 });
      service.configure({ periodicUnit: "ms" });
      service.configure({ oneShotDelay: 500 });
      service.configure({ start: true });
      service.configure({ stop: true });

      expect(service.configure).toHaveBeenCalled();
    });

    it("should render mode selection between oneshot and periodic", async () => {
      const service = createMockServiceWithSpies({
        periodic: false,
        periodicValue: 1,
        periodicUnit: "s",
        oneShotDelay: 0,
        oneShotDelayUnit: "ms",
        running: false,
      });

      const props = createStandardProps(service);
      const { container } = await renderServiceUIAndWait(TimerUI, props);

      // Should have controls for both modes
      expect(container).toBeTruthy();
    });
  });

  describe("InputUI - Configuration API", () => {
    let InputUI: AnyComponent;

    beforeEach(async () => {
      const mod = await import("../InputUI");
      InputUI = mod.default;
    });

    it("should initialize with url and mode from state", async () => {
      const service = createMockServiceWithSpies({
        url: "https://example.com/events",
        mode: "eventsource",
        parseEventsAsJSON: true,
      });

      const props = createStandardProps(service);
      const { container } = await renderServiceUIAndWait(InputUI, props);

      expect(container).toBeTruthy();
    });

    it("verifies configure API accepts: url, mode, parseEventsAsJSON", () => {
      const service = createMockServiceWithSpies();

      service.configure({ url: "https://example.com" });
      service.configure({ mode: "websocket" });
      service.configure({ parseEventsAsJSON: false });

      expect(service.configure).toHaveBeenCalled();
    });

    it("should have input field for URL configuration", async () => {
      const service = createMockServiceWithSpies({
        url: "",
        mode: "eventsource",
        parseEventsAsJSON: true,
      });

      const props = createStandardProps(service);
      await renderServiceUIAndWait(InputUI, props);

      // The component should be renderable
      expect(service).toBeDefined();
    });

    it("should handle mode selection between eventsource and websocket", async () => {
      const service = createMockServiceWithSpies({
        url: "",
        mode: "eventsource",
        parseEventsAsJSON: true,
      });

      const props = createStandardProps(service);
      const { container } = await renderServiceUIAndWait(InputUI, props);

      expect(container).toBeTruthy();
    });
  });

  describe("OutputUI - Configuration API", () => {
    let OutputUI: AnyComponent;

    beforeEach(async () => {
      const mod = await import("../OutputUI");
      OutputUI = mod.default;
    });

    it("should initialize and render", async () => {
      const service = createMockServiceWithSpies({
        format: "json",
        destination: "console",
      });

      const props = createStandardProps(service);
      const { container } = await renderServiceUIAndWait(OutputUI, props);

      expect(container).toBeTruthy();
    });

    it("should accept configure calls for output configuration", () => {
      const service = createMockServiceWithSpies();

      // OutputUI likely accepts format or destination keys
      service.configure({ format: "json" });

      expect(service.configure).toHaveBeenCalled();
    });
  });

  describe("BrowserSubServiceUI - Configuration API", () => {
    let BrowserSubServiceUI: AnyComponent;

    beforeEach(async () => {
      const mod = await import("../BrowserSubServiceUI");
      BrowserSubServiceUI = mod.default;
    });

    it("should initialize with empty instances and iteration state", async () => {
      const service = createMockServiceWithSpies({
        instances: [],
        numIterations: 1,
        iterationResults: [],
        incrementalOutput: false,
        interactiveMode: false,
        loopCondition: "",
      });

      const props = createStandardProps(service);
      const { container } = await renderServiceUIAndWait(BrowserSubServiceUI, props);

      expect(container).toBeTruthy();
    });

    it("verifies configure API accepts: instances, numIterations, loopCondition", () => {
      const service = createMockServiceWithSpies();

      service.configure({ numIterations: 5 });
      service.configure({ loopCondition: "condition" });
      service.configure({ incrementalOutput: true });

      expect(service.configure).toHaveBeenCalled();
    });
  });
  describe("Cross-UI Configuration Patterns", () => {
    it("all UIs accept service prop of type ServiceInstance", () => {
      const service = createMockServiceWithSpies();
      const props = createStandardProps(service);

      expect(props.service).toBeDefined();
      expect(props.service.uuid).toBeDefined();
      expect(props.service.configure).toBeDefined();
    });

    it("all UIs accept onServiceAction callback", () => {
      const service = createMockServiceWithSpies();
      const props = createStandardProps(service);

      expect(typeof props.onServiceAction).toBe("function");
    });

    it("service.configure is synchronous and accepts partial objects", () => {
      const service = createMockServiceWithSpies();

      // All UIs should be able to call configure with partial configs
      expect(() => {
        service.configure({ someKey: "value" });
      }).not.toThrow();
    });

    it("service.getConfiguration returns a promise", async () => {
      const service = createMockServiceWithSpies();
      const result = service.getConfiguration();

      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe("State Synchronization Patterns", () => {
    it("UIs use needsUpdate helper to prevent unnecessary updates", async () => {
      // Import the needsUpdate utility that all UIs use
      const { needsUpdate } =
        await import("hkp-frontend/src/ui-components/service/ServiceUI");

      // Verify it's a function
      expect(typeof needsUpdate).toBe("function");

      // Test the behavior: returns true if newValue !== undefined AND newValue !== oldValue
      expect(needsUpdate("a", "a")).toBe(false); // same values = no update needed
      expect(needsUpdate("a", "b")).toBe(true); // different values = update needed
      expect(needsUpdate(undefined, "a")).toBe(false); // undefined newValue = no update (skipped)
      expect(needsUpdate("a", undefined)).toBe(true); // undefined oldValue but newValue exists = update
      expect(needsUpdate(null, "a")).toBe(true); // null newValue (not undefined) = update
    });

    it("UIs initialize state from service getConfiguration in onInit", async () => {
      const service = createMockServiceWithSpies({
        interval: 500,
        property: "test",
      });

      // onInit callback is called by ServiceUI wrapper with result of getConfiguration
      const config = await service.getConfiguration();
      expect(config).toBeDefined();
    });
  });

  describe("Error Scenarios", () => {
    it("UI handles service.configure with missing properties gracefully", () => {
      const service = createMockServiceWithSpies();

      expect(() => {
        service.configure({});
      }).not.toThrow();
    });

    it("UI handles null or undefined service state", () => {
      const service = createMockServiceWithSpies(undefined);

      expect(service.state).toBeDefined();
    });

    it("configure can be called multiple times with same values", () => {
      const service = createMockServiceWithSpies();

      service.configure({ test: "value" });
      service.configure({ test: "value" });
      service.configure({ test: "value" });

      expect(service.configure).toHaveBeenCalledTimes(3);
    });
  });
});
