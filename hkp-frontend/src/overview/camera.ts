/**
 * An orbit camera and its projection.
 *
 * The camera looks at a target and is moved by turning around it rather than
 * by being flown: yaw and pitch swing around the target, distance pulls in and
 * out, and panning slides the target itself. Every position the camera can
 * reach therefore still has the board in front of it.
 *
 * Projection is perspective, done by hand — the scene is a lattice of a few
 * hundred labelled points, which is well under what a canvas can transform per
 * frame, and screen-space text stays a plain `fillText` at the projected point.
 */

export type Camera = {
  /** What the camera turns around and looks at. */
  target: { x: number; y: number; z: number };
  /** Rotation around the vertical axis, in radians. */
  yaw: number;
  /** Rotation above and below the horizon, in radians. */
  pitch: number;
  /** How far the camera sits from its target. */
  distance: number;
  /** Focal length in pixels: how much of the scene fits across the viewport. */
  focal: number;
};

export type Viewport = { width: number; height: number };

export type Projected = {
  x: number;
  y: number;
  /** Distance along the view direction. Larger is further away. */
  depth: number;
  /** How much a unit of world size covers on screen at this depth. */
  scale: number;
};

/** Nothing closer than this projects — it is behind or on the lens. */
const NEAR = 1;

/** Pitch is clamped short of straight up and down, where yaw stops meaning anything. */
export const MAX_PITCH = Math.PI / 2 - 0.05;

export function createCamera(
  center: { x: number; y: number; z: number },
  radius: number,
): Camera {
  return {
    target: { ...center },
    yaw: -0.5,
    pitch: 0.35,
    // Far enough back that the whole lattice is in frame at the default focal
    // length, with room to spare so nothing sits against the edge.
    distance: Math.max(radius * 2.4, 900),
    focal: 900,
  };
}

export function project(
  camera: Camera,
  point: { x: number; y: number; z: number },
  viewport: Viewport,
): Projected | null {
  const dx = point.x - camera.target.x;
  const dy = point.y - camera.target.y;
  const dz = point.z - camera.target.z;

  const cosYaw = Math.cos(camera.yaw);
  const sinYaw = Math.sin(camera.yaw);
  const xYawed = dx * cosYaw - dz * sinYaw;
  const zYawed = dx * sinYaw + dz * cosYaw;

  const cosPitch = Math.cos(camera.pitch);
  const sinPitch = Math.sin(camera.pitch);
  const yPitched = dy * cosPitch - zYawed * sinPitch;
  const zPitched = dy * sinPitch + zYawed * cosPitch;

  const depth = zPitched + camera.distance;
  if (depth <= NEAR) {
    return null;
  }

  const scale = camera.focal / depth;
  return {
    x: viewport.width / 2 + xYawed * scale,
    y: viewport.height / 2 + yPitched * scale,
    depth,
    scale,
  };
}

export function orbit(camera: Camera, deltaX: number, deltaY: number): Camera {
  return {
    ...camera,
    yaw: camera.yaw + deltaX * 0.006,
    pitch: Math.max(
      -MAX_PITCH,
      Math.min(MAX_PITCH, camera.pitch + deltaY * 0.006),
    ),
  };
}

export function zoom(camera: Camera, delta: number): Camera {
  // Multiplicative, so a step covers the same fraction of the remaining
  // distance whether the camera is close in or far out.
  const next = camera.distance * Math.exp(delta * 0.0015);
  return { ...camera, distance: Math.max(120, Math.min(40000, next)) };
}

/**
 * Slides the target across the plane the camera is facing, so a drag moves the
 * scene by the same amount on screen wherever the camera happens to be.
 */
export function pan(camera: Camera, deltaX: number, deltaY: number): Camera {
  const perPixel = camera.distance / camera.focal;
  const dx = -deltaX * perPixel;
  const dy = -deltaY * perPixel;

  const cosYaw = Math.cos(camera.yaw);
  const sinYaw = Math.sin(camera.yaw);
  const cosPitch = Math.cos(camera.pitch);
  const sinPitch = Math.sin(camera.pitch);

  // The screen's right and up axes expressed back in world space.
  const rightX = cosYaw;
  const rightZ = -sinYaw;
  const upX = sinYaw * sinPitch;
  const upY = cosPitch;
  const upZ = cosYaw * sinPitch;

  return {
    ...camera,
    target: {
      x: camera.target.x + rightX * dx + upX * dy,
      y: camera.target.y + upY * dy,
      z: camera.target.z + rightZ * dx + upZ * dy,
    },
  };
}
