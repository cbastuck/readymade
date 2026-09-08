import { describe, expect, it } from "vitest";

import { MAX_PITCH, createCamera, orbit, pan, project, zoom } from "../camera";

const viewport = { width: 800, height: 600 };
const origin = { x: 0, y: 0, z: 0 };

describe("camera", () => {
  it("puts the target in the middle of the viewport", () => {
    const camera = createCamera(origin, 500);
    const point = project(camera, origin, viewport)!;
    expect(point.x).toBeCloseTo(400);
    expect(point.y).toBeCloseTo(300);
  });

  it("draws what is further away smaller", () => {
    const camera = { ...createCamera(origin, 500), yaw: 0, pitch: 0 };
    const near = project(camera, { x: 100, y: 0, z: -400 }, viewport)!;
    const far = project(camera, { x: 100, y: 0, z: 400 }, viewport)!;
    expect(near.scale).toBeGreaterThan(far.scale);
    expect(Math.abs(near.x - 400)).toBeGreaterThan(Math.abs(far.x - 400));
  });

  it("drops what is behind the camera", () => {
    const camera = { ...createCamera(origin, 500), yaw: 0, pitch: 0 };
    expect(
      project(camera, { x: 0, y: 0, z: -(camera.distance + 10) }, viewport),
    ).toBeNull();
  });

  it("stops pitch short of straight overhead", () => {
    let camera = createCamera(origin, 500);
    for (let i = 0; i < 500; i += 1) {
      camera = orbit(camera, 0, 100);
    }
    expect(camera.pitch).toBeLessThanOrEqual(MAX_PITCH);
    expect(project(camera, { x: 0, y: 0, z: 100 }, viewport)).not.toBeNull();
  });

  it("keeps zoom within reach of the board", () => {
    let camera = createCamera(origin, 500);
    for (let i = 0; i < 200; i += 1) {
      camera = zoom(camera, -500);
    }
    expect(camera.distance).toBeGreaterThanOrEqual(120);
    for (let i = 0; i < 400; i += 1) {
      camera = zoom(camera, 500);
    }
    expect(camera.distance).toBeLessThanOrEqual(40000);
  });

  it("moves the scene on screen by the amount that was dragged", () => {
    const camera = { ...createCamera(origin, 500), yaw: 0, pitch: 0 };
    const before = project(camera, origin, viewport)!;
    const after = project(pan(camera, 60, -25), origin, viewport)!;
    expect(after.x - before.x).toBeCloseTo(60, 5);
    expect(after.y - before.y).toBeCloseTo(-25, 5);
  });
});
