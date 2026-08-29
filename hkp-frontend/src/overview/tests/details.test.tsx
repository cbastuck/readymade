import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import OverviewDetails from "../OverviewDetails";
import { buildScene } from "../graph";
import { defaultPalette } from "../render";
import { RuntimeDescriptor, ServiceDescriptor } from "hkp-frontend/src/types";

/**
 * The panel is the half of an overview a picture cannot carry: what a service
 * is, where it sits, and what its last call did.
 */

const runtimes = [
  { id: "rt", name: "NodeJS 1", type: "rest" },
] as unknown as RuntimeDescriptor[];

const services = {
  rt: [
    {
      uuid: "join-1",
      serviceId: "join",
      serviceName: "Join",
      state: {
        mode: "overwrite",
        pipeline: [
          { serviceId: "map", instanceId: "map-1", serviceName: "Map" },
        ],
      },
    },
  ] as unknown as ServiceDescriptor[],
};

const scene = buildScene(runtimes, services);
const palette = defaultPalette("#0abcfb");

function renderPanel(uuid: string, overrides: Record<string, unknown> = {}) {
  const onOpenInPlayground = vi.fn();
  const onClose = vi.fn();
  render(
    <OverviewDetails
      node={scene.byUuid.get(uuid)!}
      scene={scene}
      runtimeLabel="NodeJS 1"
      processing={false}
      now={10_000}
      palette={palette}
      onOpenInPlayground={onOpenInPlayground}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onOpenInPlayground, onClose };
}

describe("OverviewDetails", () => {
  it("says where a nested service sits, by the names the board uses", () => {
    renderPanel("map-1");
    expect(screen.getByText("nested 1 deep")).toBeDefined();
    expect(screen.getByText("Join / Map")).toBeDefined();
    expect(screen.getByText("NodeJS 1")).toBeDefined();
  });

  it("does not claim a path for a service that is not nested", () => {
    renderPanel("join-1");
    expect(screen.getByText("top level")).toBeDefined();
    expect(screen.queryByText(/ \/ /)).toBeNull();
  });

  it("leaves the pipeline out of the configuration it prints", () => {
    renderPanel("join-1");
    // The nesting is what the scene draws; repeating it here buries the rest.
    expect(screen.getByText(/"mode": "overwrite"/)).toBeDefined();
    expect(screen.queryByText(/"pipeline"/)).toBeNull();
  });

  it("says plainly when a service has not run", () => {
    renderPanel("join-1");
    expect(screen.getByText(/nothing since this view opened/)).toBeDefined();
    expect(
      screen.getByText(/Nothing has been handed to this service yet/),
    ).toBeDefined();
    expect(screen.getByText(/has not answered yet/)).toBeDefined();
  });

  it("shows what went in and what came out, and how long ago", () => {
    renderPanel("join-1", {
      activity: {
        calls: 3,
        litUntil: 0,
        lastIn: {
          summary: "object 2",
          preview: '{tick: 7, label: "a"}',
          at: 8_000,
        },
        lastOut: {
          summary: "array 2",
          preview: "[1, 2]",
          at: 9_500,
        },
      },
    });

    expect(screen.getByText('{tick: 7, label: "a"}')).toBeDefined();
    expect(screen.getByText("[1, 2]")).toBeDefined();
    expect(screen.getByText("object 2")).toBeDefined();
    expect(screen.getByText("array 2")).toBeDefined();
    expect(screen.getByText("2s ago")).toBeDefined();
    expect(screen.getByText("just now")).toBeDefined();
  });

  it("says where a pipeline stopped rather than showing an empty result", () => {
    renderPanel("join-1", {
      activity: {
        calls: 3,
        litUntil: 0,
        lastOut: { summary: "null", preview: "null", at: 10_000 },
        lastStopped: true,
      },
    });
    expect(screen.getByText(/the pipeline stopped here/)).toBeDefined();
  });

  it("offers going to the service as an action, not as the only one", () => {
    const { onOpenInPlayground } = renderPanel("map-1");
    fireEvent.click(screen.getByRole("button", { name: /open in playground/ }));
    expect(onOpenInPlayground).toHaveBeenCalledTimes(1);
  });
});
