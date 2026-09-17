import { describe, expect, it } from "vitest";

import { collectKnobDefaults } from "../panels/LayoutNode";
import { LayoutItem } from "../types";

/**
 * A panel holds each knob's position separately, even when two knobs turn the
 * same service.
 *
 * Which is the ordinary case, not an exotic one: the two dimensions of an
 * image, the two ends of a range. Keyed by service uuid alone they would share
 * one position, so the second knob drawn would sit wherever the first was left
 * and jump on the first drag.
 */

const layout: LayoutItem = {
  direction: "row",
  items: [
    {
      type: "knob",
      id: "cols",
      min: 20,
      max: 160,
      defaultValue: 100,
      action: { serviceUuid: "ascii-art-svc", configure: { cols: "{{value}}" } },
    },
    {
      type: "knob",
      id: "rows",
      min: 10,
      max: 120,
      defaultValue: 60,
      action: { serviceUuid: "ascii-art-svc", configure: { rows: "{{value}}" } },
    },
    {
      type: "knob",
      min: -60,
      max: 0,
      defaultValue: -12,
      action: { serviceUuid: "gate-svc", configure: { threshold: "{{value}}" } },
    },
  ],
};

describe("knob positions", () => {
  it("are kept apart for two knobs on one service", () => {
    const defaults: Record<string, number> = {};
    collectKnobDefaults(layout, defaults);

    expect(defaults.cols).toBe(100);
    expect(defaults.rows).toBe(60);
  });

  it("fall back to the service uuid, which is what level-meter names", () => {
    const defaults: Record<string, number> = {};
    collectKnobDefaults(layout, defaults);

    expect(defaults["gate-svc"]).toBe(-12);
  });
});
