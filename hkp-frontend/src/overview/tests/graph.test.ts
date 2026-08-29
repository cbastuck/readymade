import { describe, expect, it } from "vitest";

import {
  COLUMN_SPACING,
  LAYER_SPACING,
  ROW_SPACING,
  buildScene,
} from "../graph";
import { RuntimeDescriptor, ServiceDescriptor } from "hkp-frontend/src/types";

const runtime = (id: string, name: string): RuntimeDescriptor =>
  ({ id, name, type: "browser" }) as unknown as RuntimeDescriptor;

const service = (uuid: string, extra: object = {}): ServiceDescriptor =>
  ({
    uuid,
    serviceId: `hookup.to/service/${uuid}`,
    serviceName: uuid,
    ...extra,
  }) as unknown as ServiceDescriptor;

describe("buildScene", () => {
  it("places runtimes across X and services down Y", () => {
    const scene = buildScene(
      [runtime("ui", "Browser"), runtime("node", "Node")],
      { ui: [service("a"), service("b")], node: [service("c")] },
    );

    expect(scene.byUuid.get("a")!.x).toBe(0);
    expect(scene.byUuid.get("b")!.x).toBe(0);
    expect(scene.byUuid.get("c")!.x).toBe(COLUMN_SPACING);
    expect(scene.byUuid.get("b")!.y - scene.byUuid.get("a")!.y).toBe(
      ROW_SPACING,
    );
  });

  it("puts a nested pipeline behind the service hosting it", () => {
    const scene = buildScene([runtime("ui", "Browser")], {
      ui: [
        service("host", {
          state: {
            pipeline: [
              { instanceId: "inner", serviceId: "x", state: {} },
              {
                instanceId: "deeper-host",
                serviceId: "y",
                state: {
                  pipeline: [{ instanceId: "deepest", serviceId: "z" }],
                },
              },
            ],
          },
        }),
      ],
    });

    expect(scene.byUuid.get("host")!.z).toBe(0);
    expect(scene.byUuid.get("inner")!.z).toBe(LAYER_SPACING);
    expect(scene.byUuid.get("deepest")!.z).toBe(2 * LAYER_SPACING);
    // The host stays where it was; what it contains is placed behind it.
    expect(scene.byUuid.get("host")!.depth).toBe(0);
    expect(scene.byUuid.get("inner")!.depth).toBe(1);
  });

  it("records what has to be opened to reach a nested service", () => {
    const scene = buildScene([runtime("ui", "Browser")], {
      ui: [
        service("host", {
          state: {
            pipeline: [
              {
                instanceId: "mid",
                serviceId: "y",
                state: { pipeline: [{ instanceId: "leaf", serviceId: "z" }] },
              },
            ],
          },
        }),
      ],
    });

    expect(scene.byUuid.get("leaf")!.ancestry).toEqual(["host", "mid"]);
    expect(scene.byUuid.get("host")!.ancestry).toEqual([]);
  });

  it("chains the end of one runtime to the start of the next, skipping empty ones", () => {
    const scene = buildScene(
      [
        runtime("ui", "Browser"),
        runtime("empty", "Empty"),
        runtime("node", "Node"),
      ],
      { ui: [service("a"), service("b")], empty: [], node: [service("c")] },
    );

    const handoffs = scene.edges.filter((e) => e.kind === "handoff");
    expect(handoffs).toEqual([{ from: "b", to: "c", kind: "handoff" }]);
  });

  it("links a host to the pipeline it contains rather than in sequence", () => {
    const scene = buildScene([runtime("ui", "Browser")], {
      ui: [
        service("host", {
          state: { pipeline: [{ instanceId: "inner", serviceId: "x" }] },
        }),
        service("after"),
      ],
    });

    expect(scene.edges).toContainEqual({
      from: "host",
      to: "inner",
      kind: "contains",
    });
    expect(scene.edges).toContainEqual({
      from: "host",
      to: "after",
      kind: "sequence",
    });
    // A nested service is not wired to what follows its host.
    expect(
      scene.edges.some((e) => e.from === "inner" && e.to === "after"),
    ).toBe(false);
  });

  it("survives a board with nothing on it", () => {
    const scene = buildScene([], {});
    expect(scene.nodes).toEqual([]);
    expect(scene.radius).toBeGreaterThan(0);
  });
});
