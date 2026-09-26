import { describe, expect, it } from "vitest";

import {
  BlockDefinition,
  collapseBlocks,
  expandBlocks,
  linkBlocks,
  unlinkBlocks,
} from "../blocks";

const note: BlockDefinition = {
  id: "note",
  name: "Note",
  serviceId: "sub-service",
  params: { trigger: "hihat", volume: 0.5, beats: 0.5 },
  state: {
    scope: { slots: "inherit" },
    pipeline: [
      {
        serviceId: "hookup.to/service/sound",
        instanceId: "hit",
        state: { trigger: "{{param.trigger}}", volume: "{{param.volume}}" },
      },
      {
        serviceId: "hookup.to/service/timer",
        instanceId: "wait",
        state: { oneShotDelay: "{{param.beats}}", oneShotDelayUnit: "beats" },
      },
    ],
  },
};

const beat: BlockDefinition = {
  id: "beat",
  name: "Beat",
  serviceId: "sub-service",
  params: { accent: 0.5 },
  state: {
    scope: { slots: "inherit" },
    pipeline: [
      { block: "note", instanceId: "on", params: { volume: "{{param.accent}}" } },
      { block: "note", instanceId: "off", params: { volume: 0.3 } },
    ],
  },
};

const definitions = [note, beat];

function bar(pipeline: unknown[]) {
  return {
    ui: [
      {
        uuid: "bar",
        serviceId: "sub-service",
        serviceName: "Bar",
        state: { scope: { slots: "own" }, pipeline },
      },
    ],
  };
}

/** What a runtime reports: the configuration plus what it adds of its own. */
function asReported(services: any): any {
  const report = (entry: any): any => {
    if (Array.isArray(entry)) {
      return entry.map(report);
    }
    if (entry && typeof entry === "object") {
      const out: any = Object.fromEntries(
        Object.entries(entry).map(([key, value]) => [key, report(value)]),
      );
      if ("serviceId" in entry && entry.state) {
        out.state = { ...out.state, bypass: false, running: false };
      }
      return out;
    }
    return entry;
  };
  return report(services);
}

function pipelineOf(services: any): any[] {
  return services.ui[0].state.pipeline;
}

describe("expandBlocks", () => {
  it("expands a use into the definition's service, with its parameters", () => {
    const { services, diagnostics } = expandBlocks(
      bar([{ block: "note", instanceId: "kick", params: { trigger: "kick", volume: 0.9 } }]),
      definitions,
    );
    expect(diagnostics).toEqual([]);
    const [kick] = pipelineOf(services);
    expect(kick).toMatchObject({
      instanceId: "kick",
      serviceId: "sub-service",
      serviceName: "Note",
    });
    expect(kick.state.pipeline[0].state).toEqual({ trigger: "kick", volume: 0.9 });
    // A whole-string reference takes the value's type; the default fills in.
    expect(kick.state.pipeline[1].state.oneShotDelay).toBe(0.5);
  });

  it("writes a parameter inside a longer string as text", () => {
    const labelled: BlockDefinition = {
      id: "label",
      name: "Label",
      serviceId: "monitor",
      params: { n: 3 },
      state: { title: "Step {{param.n}}" },
    };
    const { services } = expandBlocks(bar([{ block: "label" }]), [labelled]);
    expect(pipelineOf(services)[0].state.title).toBe("Step 3");
  });

  it("expands nested uses, handing them what the outer block was given", () => {
    const { services } = expandBlocks(
      bar([{ block: "beat", instanceId: "b1", params: { accent: 0.8 } }]),
      definitions,
    );
    const [b1] = pipelineOf(services);
    const [on, off] = b1.state.pipeline;
    expect(on.state.pipeline[0].state.volume).toBe(0.8);
    expect(off.state.pipeline[0].state.volume).toBe(0.3);
  });

  it("gives a use without an id one of its own", () => {
    const { services } = expandBlocks(bar([{ block: "note" }, { block: "note" }]), definitions);
    expect(pipelineOf(services).map((entry) => entry.instanceId)).toEqual([
      "note-0",
      "note-1",
    ]);
  });

  it("addresses a use in a runtime's own services by uuid", () => {
    const { services } = expandBlocks({ ui: [{ block: "note", uuid: "n" } as any] }, definitions);
    expect(services.ui[0]).toMatchObject({ uuid: "n", serviceId: "sub-service" });
  });

  it("reports an unknown block and a block that uses itself", () => {
    const loop: BlockDefinition = {
      id: "loop",
      name: "Loop",
      serviceId: "sub-service",
      state: { pipeline: [{ block: "loop" }] },
    };
    const { diagnostics } = expandBlocks(bar([{ block: "missing" }, { block: "loop" }]), [loop]);
    expect(diagnostics.map((entry) => entry.code)).toEqual(["block-unknown", "block-cycle"]);
    expect(diagnostics.every((entry) => entry.level === "error")).toBe(true);
  });

  it("leaves a parameter with no value in place and warns", () => {
    const loose: BlockDefinition = {
      id: "loose",
      name: "Loose",
      serviceId: "monitor",
      state: { topic: "{{param.topic}}" },
    };
    const { services, diagnostics } = expandBlocks(bar([{ block: "loose" }]), [loose]);
    expect(pipelineOf(services)[0].state.topic).toBe("{{param.topic}}");
    expect(diagnostics).toMatchObject([{ level: "warning", code: "block-param-missing" }]);
  });

  it("leaves ordinary services alone", () => {
    const plain = bar([{ serviceId: "monitor", instanceId: "m", state: { block: "x" } }]);
    const { services, placed } = expandBlocks(plain, definitions);
    expect(services).toEqual(plain);
    expect(placed).toEqual([]);
  });
});

describe("collapseBlocks", () => {
  const source = bar([
    { block: "note", instanceId: "kick", params: { trigger: "kick", volume: 0.9 } },
    { serviceId: "monitor", instanceId: "m", state: {} },
    { block: "beat", instanceId: "b1", params: { accent: 0.8 } },
    { block: "note" },
  ]);

  function run() {
    const { services, placed } = expandBlocks(source, definitions);
    return { reported: asReported(services), linkage: { definitions, placed } };
  }

  it("writes an untouched board back exactly as it was written", () => {
    const { reported, linkage } = run();
    const collapsed = collapseBlocks(reported, linkage);
    expect(pipelineOf(collapsed)[0]).toEqual(pipelineOf(source)[0]);
    expect(pipelineOf(collapsed)[2]).toEqual(pipelineOf(source)[2]);
    expect(pipelineOf(collapsed)[3]).toEqual(pipelineOf(source)[3]);
  });

  it("breaks a changed use off into a copy of its own, and only that one", () => {
    const { reported, linkage } = run();
    pipelineOf(reported)[0].state.pipeline[1].state.oneShotDelay = 0.25;
    const collapsed = collapseBlocks(reported, linkage);
    const [kick, , b1, last] = pipelineOf(collapsed);
    expect(kick.block).toBeUndefined();
    expect(kick.serviceId).toBe("sub-service");
    expect(kick.state.pipeline[1].state.oneShotDelay).toBe(0.25);
    expect(b1).toEqual({ block: "beat", instanceId: "b1", params: { accent: 0.8 } });
    expect(last).toEqual({ block: "note" });
  });

  it("keeps the untouched uses inside a block that broke off", () => {
    const { reported, linkage } = run();
    const b1 = pipelineOf(reported)[2];
    b1.state.pipeline[1].state.pipeline[0].state.volume = 0.1;
    const collapsed = collapseBlocks(reported, linkage);
    const copy = pipelineOf(collapsed)[2];
    expect(copy.serviceId).toBe("sub-service");
    const [on, off] = copy.state.pipeline;
    // The untouched nested use keeps what it was given by the outer block.
    expect(on).toEqual({ block: "note", instanceId: "on", params: { volume: 0.8 } });
    expect(off.serviceId).toBe("sub-service");
    expect(off.state.pipeline[0].state.volume).toBe(0.1);
  });

  it("counts bypassing a service inside a use as a change", () => {
    const { reported, linkage } = run();
    pipelineOf(reported)[0].state.pipeline[0].state.bypass = true;
    expect(pipelineOf(collapseBlocks(reported, linkage))[0].block).toBeUndefined();
  });

  it("keeps a renamed use a use, under its new name", () => {
    const { reported, linkage } = run();
    pipelineOf(reported)[0].serviceName = "Kick";
    expect(pipelineOf(collapseBlocks(reported, linkage))[0]).toEqual({
      block: "note",
      instanceId: "kick",
      params: { trigger: "kick", volume: 0.9 },
      serviceName: "Kick",
    });
  });

  it("finds a use by its id after a service was inserted before it", () => {
    const { reported, linkage } = run();
    pipelineOf(reported).unshift({ serviceId: "monitor", instanceId: "new", state: {} });
    const collapsed = collapseBlocks(reported, linkage);
    expect(pipelineOf(collapsed)[1]).toEqual(pipelineOf(source)[0]);
  });

  it("writes whatever replaced a removed use as it is", () => {
    const { reported, linkage } = run();
    pipelineOf(reported).splice(0, 1);
    const collapsed = collapseBlocks(reported, linkage);
    expect(pipelineOf(collapsed)).toHaveLength(3);
    expect(pipelineOf(collapsed)[1]).toEqual(pipelineOf(source)[2]);
  });
});

describe("linkBlocks / unlinkBlocks", () => {
  it("runs a board without its definitions and saves it with them", () => {
    const board = {
      runtimes: [{ id: "ui", name: "Browser", type: "browser" as const }],
      services: bar([{ block: "note", instanceId: "kick" }]),
      blocks: definitions,
    };
    const linked = linkBlocks(board as any);
    expect(linked.board.blocks).toBeUndefined();
    const saved = unlinkBlocks(
      { ...linked.board, services: asReported(linked.board.services) },
      linked.linkage,
    );
    expect(saved.blocks).toEqual(definitions);
    expect(pipelineOf(saved.services)).toEqual(pipelineOf(board.services));
  });

  it("leaves a board without blocks as it is", () => {
    const board = { runtimes: [], services: bar([]) };
    expect(linkBlocks(board as any)).toEqual({ board, diagnostics: [] });
  });
});
