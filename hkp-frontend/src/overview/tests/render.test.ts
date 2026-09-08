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

/** A canvas that records nothing and refuses nothing. */
function stubContext() {
  return new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "measureText") {
          return (text: string) => ({ width: text.length * 6 });
        }
        return () => {};
      },
      set() {
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
    expect(hits.map((h) => h.uuid).sort()).toEqual(
      scene.nodes.map((n) => n.uuid).sort(),
    );
  });

  it("draws what is further away smaller", () => {
    const { hits } = renderScene();
    const top = hits.find((h) => h.uuid === "join-1")!;
    const nested = hits.find((h) => h.uuid === "map-1")!;

    expect(nested.depth).toBeGreaterThan(top.depth);
    expect(nested.width).toBeLessThan(top.width);
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
