import { describe, expect, it } from "vitest";

import { paletteFor, paletteKey } from "../palette";
import { Preset } from "../presets";
import { BlockDefinition } from "../../runtime/board/blocks";
import { ServiceClass } from "../../types";

const SUB: ServiceClass = {
  serviceId: "hookup.to/service/sub-service",
  serviceName: "SubService",
  capabilities: ["subservices"],
};
const TIMER: ServiceClass = {
  serviceId: "hookup.to/service/timer",
  serviceName: "Timer",
};

const pipeline = (name: string): Preset => ({
  preset: "v1",
  id: name.toLowerCase(),
  name,
  serviceId: "sub-service",
  state: { pipeline: [{ serviceId: "timer", instanceId: "t" }] },
});

const withParams = (preset: Preset): Preset => ({
  ...preset,
  params: { period: 1000 },
  state: {
    pipeline: [
      { serviceId: "timer", instanceId: "t", state: { period: "{{period}}" } },
    ],
  },
});

const block = (id: string, name: string): BlockDefinition => ({
  id,
  name,
  serviceId: "sub-service",
  state: { pipeline: [] },
});

describe("paletteFor", () => {
  it("offers a runtime's services once each, in the order it lists them", () => {
    const entries = paletteFor([TIMER, SUB, TIMER], "browser", [], []);
    expect(entries.map((e) => e.serviceName)).toEqual(["Timer", "SubService"]);
  });

  it("offers the sub-service presets kept on this device, named after the preset", () => {
    const entries = paletteFor([TIMER, SUB], "browser", [pipeline("Ticker")], []);
    const preset = entries.find((e) => e.preset);
    expect(preset).toMatchObject({
      serviceId: SUB.serviceId,
      serviceName: "Ticker",
      preset: { id: "ticker", serviceId: "sub-service" },
    });
    // Applied as a copy: only one that declares params is placed as a block.
    expect(preset?.preset?.use).toBeUndefined();
    const usable = paletteFor([SUB], "browser", [withParams(pipeline("Ticker"))], []);
    expect(usable.find((e) => e.preset)?.preset?.use).toBe(true);
  });

  it("offers presets only where there is a sub-service to put them in", () => {
    expect(paletteFor([TIMER], "browser", [pipeline("Ticker")], [])).toHaveLength(1);
  });

  it("offers a preset only to the runtimes it says it belongs on", () => {
    const pythonOnly = { ...pipeline("Model"), runtimes: ["python"] };
    expect(
      paletteFor([SUB], "browser", [pythonOnly], []).some((e) => e.preset),
    ).toBe(false);
  });

  it("puts the board's own blocks first", () => {
    const entries = paletteFor(
      [TIMER, SUB],
      "browser",
      [],
      [block("a", "First"), block("b", "Second")],
    );
    expect(entries.map((e) => e.serviceName)).toEqual([
      "Second",
      "First",
      "Timer",
      "SubService",
    ]);
    expect(entries[0].block).toEqual({ id: "b" });
    expect(paletteKey(entries[0])).toBe("block:b");
  });

  it("keeps a board's copy of a library block behind the library's entry", () => {
    const library = withParams(pipeline("Ticker"));
    const { preset: _marker, ...copied } = library;
    const entries = paletteFor([SUB], "browser", [library], [copied]);
    expect(entries.filter((e) => e.block)).toHaveLength(0);
    expect(entries.filter((e) => e.preset)).toHaveLength(1);
  });

  it("offers a block only where the runtime has the service it is made of", () => {
    expect(paletteFor([TIMER], "browser", [], [block("a", "First")])).toHaveLength(1);
  });
});
