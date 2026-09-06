import { describe, expect, it } from "vitest";

import { previewValue } from "../preview";

/**
 * Previews are written on every call every service takes, so the cost has to
 * be what is shown rather than what it was cut from — and nothing may hold on
 * to the value once the call that carried it is over.
 */

describe("previewValue", () => {
  it("shows small values whole", () => {
    expect(previewValue({ tick: 7, ok: true })).toBe("{tick: 7, ok: true}");
    expect(previewValue([1, 2, 3])).toBe("[1, 2, 3]");
    expect(previewValue(null)).toBe("null");
    expect(previewValue("hi")).toBe('"hi"');
  });

  it("summarises a buffer by its head rather than all of it", () => {
    const buffer = new Float32Array(4096);
    buffer[0] = 0.5;
    const text = previewValue(buffer);
    expect(text).toContain("Float32Array(4096)");
    expect(text).toContain("0.5");
    expect(text.length).toBeLessThan(80);
  });

  it("costs what it shows, not what it was given", () => {
    const huge = Array.from({ length: 100_000 }, (_, i) => ({
      index: i,
      label: `row ${i}`,
    }));
    const started = performance.now();
    const text = previewValue(huge);
    const elapsed = performance.now() - started;

    expect(text.endsWith("…")).toBe(true);
    expect(text.length).toBeLessThan(600);
    // Walking all 100k rows would not come in anywhere near this.
    expect(elapsed).toBeLessThan(50);
  });

  it("survives a value that refers to itself", () => {
    const cyclic: Record<string, unknown> = { name: "loop" };
    cyclic.self = cyclic;
    expect(previewValue(cyclic)).toContain("[circular]");
  });

  it("stops before descending forever", () => {
    let deep: unknown = "bottom";
    for (let i = 0; i < 20; i += 1) {
      deep = { down: deep };
    }
    expect(previewValue(deep)).toContain("…");
  });

  it("cuts a long string rather than carrying it", () => {
    const text = previewValue("x".repeat(5_000));
    expect(text.length).toBeLessThan(200);
  });
});
