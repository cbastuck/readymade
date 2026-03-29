import React from "react";
import { describe, expect, it, vi } from "vitest";

type AnyComponent = (props: any) => React.ReactElement | null;

const serviceModuleLoaders = import.meta.glob("./*.{ts,tsx,js,jsx}");
const candidateEntries = Object.entries(serviceModuleLoaders).filter(
  ([modulePath]) => {
    if (modulePath.includes(".test.")) {
      return false;
    }
    const fileName = modulePath.split("/").at(-1) || "";
    // Match files that either end in UI.tsx or contain UI in their name
    return (
      fileName.includes("UI.") ||
      fileName.endsWith("UI.tsx") ||
      fileName.endsWith("UI.jsx") ||
      fileName.endsWith("UI.ts") ||
      fileName.endsWith("UI.js")
    );
  },
);

function createMockService() {
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
    uuid: "svc-1",
    serviceId: "test/service",
    serviceName: "Test Service",
    board: "test-board",
    state: {},
    steps: [],
    currentStep: 0,
    repeat: false,
    register: vi.fn(),
    unregister: vi.fn(),
    configure: vi.fn(),
    process: vi.fn(),
    getConfiguration: vi.fn(async () => ({})),
    destroy: vi.fn(),
  };
}

function extractUiComponents(
  modulePath: string,
  mod: Record<string, unknown>,
): AnyComponent[] {
  const fileName = modulePath.split("/").at(-1) || "";
  const found: AnyComponent[] = [];

  const defaultExport = mod.default as unknown;
  if (typeof defaultExport === "function") {
    found.push(defaultExport as AnyComponent);
  }

  if (
    defaultExport &&
    typeof defaultExport === "object" &&
    "createUI" in (defaultExport as Record<string, unknown>)
  ) {
    const createUI = (defaultExport as { createUI?: unknown }).createUI;
    if (typeof createUI === "function") {
      found.push(createUI as AnyComponent);
    }
  }

  for (const [name, value] of Object.entries(mod)) {
    if (name.endsWith("UI") && typeof value === "function") {
      found.push(value as AnyComponent);
    }
  }

  return Array.from(new Set(found));
}

function instantiateWithoutThrow(Component: AnyComponent): void {
  const service = createMockService();
  const props = {
    service,
    boardName: "test-board",
    runtimeId: "runtime-1",
    userId: "user-1",
    registry: {
      findServiceModule: vi.fn(),
      getServiceClasses: vi.fn(() => []),
    },
    runtime: {
      id: "runtime-1",
      app: service.app,
    },
    onServiceAction: vi.fn(),
    children: React.createElement("div", null, "content"),
    segments: [
      {
        name: "main",
        render: () => React.createElement("div", null, "segment"),
      },
    ],
  };

  const element = React.createElement(Component, props);
  expect(React.isValidElement(element)).toBe(true);
}

describe("runtime browser service UI smoke tests", () => {
  it("finds service UI modules to validate", () => {
    expect(candidateEntries.length).toBeGreaterThan(0);
  });

  for (const [modulePath, loadModule] of candidateEntries) {
    it(`${modulePath} exports at least one UI component`, async () => {
      const mod = (await loadModule()) as Record<string, unknown>;
      const components = extractUiComponents(modulePath, mod);
      expect(components.length).toBeGreaterThan(0);
    });

    it(`${modulePath} UI components can be instantiated`, async () => {
      const mod = (await loadModule()) as Record<string, unknown>;
      const components = extractUiComponents(modulePath, mod);
      expect(components.length).toBeGreaterThan(0);
      for (const Component of components) {
        expect(() => instantiateWithoutThrow(Component)).not.toThrow();
      }
    });
  }
});
