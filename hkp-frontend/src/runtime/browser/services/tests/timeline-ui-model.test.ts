/**
 * The Timeline panel's edits: each one a function from what the service holds
 * to what to configure it with.
 */
import { describe, expect, it } from "vitest";
import {
  addAction,
  displayLength,
  EMPTY_VIEW,
  moveAction,
  moveKeyframe,
  objectAt,
  parseFieldValue,
  propertiesOf,
  readView,
  removeKeyframe,
  setEase,
  setValue,
  snap,
  TimelineView,
  toggleKey,
  valueOf,
  withImage,
} from "../TimelineUI/model";

const image = { type: "image", url: "a.png", height: "20%" };
const view = (over: Partial<TimelineView> = {}): TimelineView => ({
  ...EMPTY_VIEW,
  object: image,
  length: 4,
  ...over,
});
const rotate = [
  { at: 0, value: 0 },
  { at: 2, value: 360 },
];

describe("reading the service", () => {
  it("takes what a notification says over what the panel has", () => {
    const next = readView({ t: 1.5, running: true, unknown: 1 }, view());
    expect(next.t).toBe(1.5);
    expect(next.running).toBe(true);
    expect(next.object).toBe(image);
    expect((next as any).unknown).toBeUndefined();
  });

  it("shows a bounded timeline's length, and room past an unbounded one's contents", () => {
    expect(displayLength(view())).toBe(4);
    expect(displayLength(view({ length: 0, actions: [{ at: 8 }] }))).toBe(10);
    expect(displayLength(view({ length: 0 }))).toBe(4);
  });

  it("offers an image's properties, then any other keyframed", () => {
    expect(propertiesOf(view({ keyframes: { blur: rotate } }), ["glow"])).toEqual([
      "centerX",
      "centerY",
      "height",
      "rotate",
      "scale",
      "opacity",
      "blur",
      "glow",
    ]);
  });

  it("reads a value from its keyframes, else the object, else its default", () => {
    const v = view({ keyframes: { rotate } });
    expect(valueOf(v, "rotate", 1)).toBe(180);
    expect(valueOf(v, "height", 1)).toBe("20%");
    expect(valueOf(v, "scale", 1)).toBe(1);
    expect(objectAt(v, 1)).toEqual({ ...image, rotate: 180 });
  });
});

describe("setting values", () => {
  it("changes a fixed value of the object when the property is not animated", () => {
    expect(setValue(view(), "height", 1, "40%")).toEqual({
      object: { ...image, height: "40%" },
    });
  });

  it("sets a keyframe at the playhead on an animated property", () => {
    const { keyframes } = setValue(view({ keyframes: { rotate } }), "rotate", 1, 90);
    expect(keyframes!.rotate).toEqual([
      { at: 0, value: 0 },
      { at: 1, value: 90 },
      { at: 2, value: 360 },
    ]);
  });

  it("changes the keyframe already at the playhead", () => {
    const { keyframes } = setValue(view({ keyframes: { rotate } }), "rotate", 2.01, 720);
    expect(keyframes!.rotate).toEqual([
      { at: 0, value: 0 },
      { at: 2, value: 720 },
    ]);
  });

  it("reads numbers typed into a field as numbers", () => {
    expect(parseFieldValue(" 42 ")).toBe(42);
    expect(parseFieldValue("30%")).toBe("30%");
  });
});

describe("the key button", () => {
  it("starts animating a fixed value with a keyframe at its value", () => {
    expect(toggleKey(view(), "height", 1.02).keyframes).toEqual({
      height: [{ at: 1, value: "20%" }],
    });
  });

  it("adds a keyframe at the value the property has there", () => {
    const { keyframes } = toggleKey(view({ keyframes: { rotate } }), "rotate", 0.5);
    expect(keyframes!.rotate[1]).toEqual({ at: 0.5, value: 90 });
  });

  it("takes away the keyframe at the playhead", () => {
    const { keyframes } = toggleKey(view({ keyframes: { rotate } }), "rotate", 2);
    expect(keyframes!.rotate).toEqual([{ at: 0, value: 0 }]);
  });

  it("leaves the last keyframe's value as the object's when it is taken away", () => {
    const v = view({ keyframes: { rotate: [{ at: 1, value: 45 }] } });
    expect(removeKeyframe(v, "rotate", 0)).toEqual({
      keyframes: {},
      object: { ...image, rotate: 45 },
    });
  });
});

describe("moving and easing", () => {
  it("moves a keyframe, snapped, and says where it went", () => {
    const moved = moveKeyframe({ rotate }, "rotate", 0, 3.013);
    expect(moved.keyframes.rotate.map((k) => k.at)).toEqual([2, 3]);
    expect(moved.index).toBe(1);
  });

  it("eases the way a value leaves a keyframe", () => {
    expect(setEase({ rotate }, "rotate", 0, "in-out").rotate[0].ease).toBe("in-out");
  });

  it("places and moves actions on the snap, keeping their order", () => {
    const actions = addAction([{ at: 1, data: "a" }], 0.51);
    expect(actions).toEqual([
      { at: 1, data: "a" },
      { at: 0.5, data: {} },
    ]);
    expect(moveAction(actions, 0, 2.22)[0].at).toBe(2.2);
    expect(snap(-1)).toBe(0);
  });
});

describe("dropping an image", () => {
  it("changes what an image shows, keeping how it is placed", () => {
    expect(withImage(image, "b.png")).toEqual({ ...image, url: "b.png" });
  });

  it("makes anything else an image, centred", () => {
    expect(withImage(null, "b.png")).toEqual({
      type: "image",
      url: "b.png",
      centerX: "50%",
      centerY: "50%",
      height: "60%",
    });
  });
});
