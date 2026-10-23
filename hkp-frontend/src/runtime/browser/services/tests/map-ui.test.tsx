import React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

import { ServiceInstance } from "hkp-frontend/src/types";

import MapUI from "../MapUI";

/**
 * The Map panel is shared by every runtime's Map (`map@v1`), so what a pass
 * says about itself — `error` and `warnings`, notified and never saved — is
 * shown here once for all of them.
 */

function createMapService() {
  const app = {
    registerNotificationTarget: vi.fn(),
    unregisterNotificationTarget: vi.fn(),
    notify: vi.fn(),
  };
  return {
    app,
    uuid: "map-1",
    serviceId: "hookup.to/service/map",
    serviceName: "Map",
    board: "test-board",
    configure: vi.fn(),
    process: vi.fn(),
    getConfiguration: vi.fn(async () => ({ mode: "replace", template: {} })),
    destroy: vi.fn(),
  } as unknown as ServiceInstance;
}

async function renderMapUI() {
  const service = createMapService();
  render(React.createElement(MapUI, { service, onServiceAction: vi.fn() }));
  await waitFor(() => expect(service.getConfiguration).toHaveBeenCalled());
  // Every target the panel registered, as the runtime would deliver to them.
  const targets = (service.app.registerNotificationTarget as any).mock.calls.map(
    ([, target]: [unknown, (n: unknown) => void]) => target,
  );
  return (notification: unknown) =>
    act(async () => targets.forEach((target: (n: unknown) => void) => target(notification)));
}

describe("MapUI", () => {
  it("shows the error and the warnings a pass reported, and clears them", async () => {
    const notify = await renderMapUI();

    await notify({
      error: "x: params.n.toFixed is not a function",
      warnings: ["title: params.titel not found"],
    });
    expect(screen.getByText("x: params.n.toFixed is not a function")).toBeTruthy();
    expect(screen.getByText("title: params.titel not found")).toBeTruthy();

    await notify({ error: "" });
    await notify({ warnings: [] });
    expect(screen.queryByText("x: params.n.toFixed is not a function")).toBeNull();
    expect(screen.queryByText("title: params.titel not found")).toBeNull();
  });

  it("keeps what it shows when a notification is about something else", async () => {
    const notify = await renderMapUI();

    await notify({ warnings: ["title: params.titel not found"] });
    await notify({ mode: "add" });
    expect(screen.getByText("title: params.titel not found")).toBeTruthy();
  });
});
