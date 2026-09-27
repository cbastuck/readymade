import { describe, expect, it } from "vitest";

import { buildScene } from "../graph";
import { createCamera } from "../camera";
import { ActivityTracker } from "../activity";
import { defaultPalette, hitTest, render } from "../render";
import { RuntimeDescriptor, ServiceDescriptor } from "hkp-frontend/src/types";

/**
 * What the renderer hands back is what a click is matched against, so every
 * node that was drawn has to be there, sized as it was drawn.
 */

const viewport = { width: 900, height: 700 };

/** What a card is filled with, which is not a ground. */
const WHITE_FILL = "rgb(255, 255, 255)";

const runtimes = [
  { id: "rt", name: "NodeJS 1", type: "rest" },
] as unknown as RuntimeDescriptor[];

const services = {
  rt: [
    { uuid: "timer-1", serviceId: "timer", serviceName: "Timer" },
    {
      uuid: "join-1",
      serviceId: "join",
      serviceName: "Join",
      state: { pipeline: [{ serviceId: "map", instanceId: "map-1" }] },
    },
  ] as unknown as ServiceDescriptor[],
};

/** A canvas that refuses nothing and keeps only what it was told to fill with. */
function stubContext(fills: string[] = []) {
  return new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "measureText") {
          return (text: string) => ({ width: text.length * 6 });
        }
        return () => {};
      },
      set(_target, prop: string, value: unknown) {
        if (prop === "fillStyle" && typeof value === "string") {
          fills.push(value);
        }
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
}

function renderScene() {
  const scene = buildScene(runtimes, services);
  const camera = createCamera(scene.center, scene.radius);
  const hits = render(stubContext(), {
    scene,
    camera,
    viewport,
    activity: new ActivityTracker(),
    palette: defaultPalette("#0abcfb"),
    now: 0,
  });
  return { scene, camera, hits };
}

describe("render", () => {
  it("hands back a target for every node it drew, nesting included", () => {
    const { scene, hits } = renderScene();
    expect(hits.map((h) => h.key).sort()).toEqual(
      scene.nodes.map((n) => n.key).sort(),
    );
  });

  it("draws what is further away smaller", () => {
    const { hits } = renderScene();
    const top = hits.find((h) => h.key === "join-1")!;
    const nested = hits.find((h) => h.key === "join-1.map-1")!;

    expect(nested.depth).toBeGreaterThan(top.depth);
    expect(nested.width).toBeLessThan(top.width);
  });

  it("grounds every pipeline in the colour the runtime carries", () => {
    // A service holding a service holding a service, as deep as asked for.
    const nest = (levels: number) => {
      let entry: any = { instanceId: "leaf", serviceId: "map" };
      for (let i = levels; i > 0; i -= 1) {
        entry = {
          instanceId: `level-${i}`,
          serviceId: "sub-service",
          state: { pipeline: [entry] },
        };
      }
      return {
        rt: [{ ...entry, uuid: entry.instanceId }] as ServiceDescriptor[],
      };
    };

    const fillsFor = (color: string | undefined, ground?: string) => {
      const board = [
        { id: "rt", name: "NodeJS 1", type: "rest", state: { color } },
      ] as unknown as RuntimeDescriptor[];
      const scene = buildScene(board, nest(2));
      const fills: string[] = [];
      render(stubContext(fills), {
        scene,
        camera: createCamera(scene.center, scene.radius),
        viewport,
        activity: new ActivityTracker(),
        palette: defaultPalette("#0abcfb", ground),
        now: 0,
      });
      // The cards are white and the view's own background is a hex, so what
      // is left is the grounds.
      return fills.filter(
        (fill) => fill.startsWith("rgb(") && fill !== WHITE_FILL,
      );
    };

    // Three pipelines here — the runtime's own and the two inside it — and
    // each stands in the colour the board gave the runtime, however deep it
    // is: what tells the levels apart is which is drawn over which.
    expect(fillsFor("#6366f1")).toEqual([
      "rgb(99, 102, 241)",
      "rgb(99, 102, 241)",
      "rgb(99, 102, 241)",
    ]);

    // A runtime that was never coloured stands on the appearance default the
    // board itself is drawn with, rather than on nothing.
    expect(fillsFor(undefined, "#eef2fc")).toContain("rgb(238, 242, 252)");
  });

  it("picks the nearest node where two overlap", () => {
    const near = {
      uuid: "near",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      depth: 10,
    };
    const far = { uuid: "far", x: 0, y: 0, width: 100, height: 50, depth: 90 };

    expect(hitTest([far, near], 50, 25)?.uuid).toBe("near");
    expect(hitTest([near, far], 50, 25)?.uuid).toBe("near");
    expect(hitTest([near, far], 500, 25)).toBeNull();
  });
});
