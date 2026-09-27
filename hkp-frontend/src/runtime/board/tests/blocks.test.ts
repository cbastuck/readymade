import { describe, expect, it } from "vitest";

import {
  BlockDefinition,
  BlockLinkage,
  collapseBlocks,
  definitionFromWorkingCopy,
  detachUse,
  expandBlocks,
  findEntryPath,
  usesToRefresh,
  withBlockFrom,
  withNewUse,
  outermostUses,
  blockUseAt,
  blockUseContaining,
  withUseParams,
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

const definitions = { "": [note, beat] };

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

function pipelineOf(services: any): any[] {
  return services.ui[0].state.pipeline;
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

function link(pipeline: unknown[]) {
  const source = bar(pipeline);
  const expansion = expandBlocks(source, definitions);
  const linkage: BlockLinkage = { definitions, placed: expansion.placed };
  return { source, ...expansion, linkage };
}

describe("expanding", () => {
  it("expands a use into the definition's service, with its parameters", () => {
    const { services, diagnostics } = link([
      { block: "note", instanceId: "kick", params: { trigger: "kick", volume: 0.9 } },
    ]);
    expect(diagnostics).toEqual([]);
    const [kick] = pipelineOf(services);
    expect(kick).toMatchObject({ instanceId: "kick", serviceId: "sub-service", serviceName: "Note" });
    expect(kick.state.pipeline[0].state).toEqual({ trigger: "kick", volume: 0.9 });
    // A whole-string reference takes the value's type; the default fills in.
    expect(kick.state.pipeline[1].state.oneShotDelay).toBe(0.5);
  });

  it("expands nested uses, handing them what the outer block was given", () => {
    const { services } = link([{ block: "beat", instanceId: "b1", params: { accent: 0.8 } }]);
    const [on, off] = pipelineOf(services)[0].state.pipeline;
    expect(on.state.pipeline[0].state.volume).toBe(0.8);
    expect(off.state.pipeline[0].state.volume).toBe(0.3);
  });

  it("expands a block named by a parameter", () => {
    const twice: BlockDefinition = {
      id: "twice",
      name: "Twice",
      serviceId: "sub-service",
      params: { of: "note" },
      state: { pipeline: [{ block: "{{param.of}}" }, { block: "{{param.of}}" }] },
    };
    const { services, diagnostics } = expandBlocks(bar([{ block: "twice", params: { of: "beat" } }]), {
      "": [note, beat, twice],
    });
    expect(diagnostics).toEqual([]);
    expect(pipelineOf(services)[0].state.pipeline.map((entry: any) => entry.serviceName)).toEqual([
      "Beat",
      "Beat",
    ]);
  });

  it("gives uses without an id ids nothing beside them has", () => {
    const { services } = link([
      { serviceId: "monitor", instanceId: "note-1", state: {} },
      { block: "note" },
      { block: "note" },
    ]);
    expect(pipelineOf(services).map((entry) => entry.instanceId)).toEqual([
      "note-1",
      "note-2",
      "note-3",
    ]);
  });

  it("addresses a use in a runtime's own services by uuid", () => {
    const { services, placed } = expandBlocks({ ui: [{ block: "note", uuid: "n" } as any] }, definitions);
    expect(services.ui[0]).toMatchObject({ uuid: "n", serviceId: "sub-service" });
    expect(placed[0].address).toBe("n");
  });

  it("places each use with its address and the use it sits inside", () => {
    const { placed } = link([{ block: "beat", instanceId: "b1" }]);
    const outer = placed.find((entry) => entry.address === "bar.b1")!;
    const inner = placed.find((entry) => entry.address === "bar.b1.on")!;
    expect(outer.parent).toBeUndefined();
    expect(inner.parent).toBe(outer.key);
  });

  it("resolves a runtime's uses against the blocks of the document it came from", () => {
    const theirs: BlockDefinition = { ...note, name: "Their note" };
    const { services, diagnostics } = expandBlocks(
      { own: [{ block: "note", uuid: "a" } as any], "shop.intake": [{ block: "note", uuid: "b" } as any] },
      { "": [note], shop: [theirs] },
      (runtimeId) => (runtimeId.startsWith("shop.") ? "shop" : ""),
    );
    expect(diagnostics).toEqual([]);
    expect(services.own[0].serviceName).toBe("Note");
    expect(services["shop.intake"][0].serviceName).toBe("Their note");
  });

  it("does not let a unit's uses see the composition's blocks", () => {
    const { diagnostics } = expandBlocks(
      { "shop.intake": [{ block: "note", uuid: "b" } as any] },
      { "": [note] },
      () => "shop",
    );
    expect(diagnostics).toMatchObject([{ level: "error", code: "block-unknown", unit: "shop" }]);
  });

  it("reports an unknown block, a block that uses itself, and a duplicate", () => {
    const loop: BlockDefinition = {
      id: "loop",
      name: "Loop",
      serviceId: "sub-service",
      state: { pipeline: [{ block: "loop" }] },
    };
    const { diagnostics } = expandBlocks(bar([{ block: "missing" }, { block: "loop" }]), {
      "": [loop, loop],
    });
    expect(diagnostics.map((entry) => entry.code).sort()).toEqual([
      "block-cycle",
      "block-duplicate",
      "block-unknown",
    ]);
  });

  it("warns about a parameter a use passes that the block does not declare", () => {
    const { diagnostics } = link([{ block: "note", params: { pitch: 3 } }]);
    expect(diagnostics).toMatchObject([{ level: "warning", code: "block-param-undeclared" }]);
  });

  it("warns about a parameter a definition refers to without declaring", () => {
    const loose: BlockDefinition = {
      id: "loose",
      name: "Loose",
      serviceId: "monitor",
      state: { topic: "{{param.topic}}" },
    };
    const { services, diagnostics } = expandBlocks(bar([{ block: "loose" }]), { "": [loose] });
    expect(pipelineOf(services)[0].state.topic).toBe("{{param.topic}}");
    expect(diagnostics.map((entry) => entry.code).sort()).toEqual([
      "block-param-missing",
      "block-param-undeclared",
    ]);
  });

  it("leaves ordinary services alone", () => {
    const plain = bar([{ serviceId: "monitor", instanceId: "m", state: { block: "x" } }]);
    const { services, placed } = expandBlocks(plain, definitions);
    expect(services).toEqual(plain);
    expect(placed).toEqual([]);
  });

  it("reads data a service holds as data in a board without blocks", () => {
    const holding = {
      ui: [
        {
          uuid: "table",
          serviceId: "data-table",
          state: { rows: [{ block: "center" }, { block: "left", uuid: "r1" }] },
        },
      ],
    };
    const { services, placed, diagnostics } = expandBlocks(holding, {});
    expect(services).toEqual(holding);
    expect(placed).toEqual([]);
    expect(diagnostics).toEqual([]);
  });

  it("reads an object saying more than a use can as data", () => {
    const holding = bar([
      { serviceId: "monitor", instanceId: "m", state: { items: [{ block: "note", label: "x" }] } },
    ]);
    const { services, placed, diagnostics } = expandBlocks(holding, definitions);
    expect(services).toEqual(holding);
    expect(placed).toEqual([]);
    expect(diagnostics).toEqual([]);
  });

  it("still reports an unknown use in a runtime's own services without blocks", () => {
    const { diagnostics } = expandBlocks({ ui: [{ block: "note", uuid: "a" } as any] }, {});
    expect(diagnostics).toMatchObject([{ level: "error", code: "block-unknown" }]);
  });
});

describe("saving", () => {
  const uses = [
    { block: "note", instanceId: "kick", params: { trigger: "kick", volume: 0.9 } },
    { serviceId: "monitor", instanceId: "m", state: {} },
    { block: "beat", instanceId: "b1", params: { accent: 0.8 } },
    { block: "note" },
  ];

  it("writes every use back as it was written", () => {
    const { source, services, linkage } = link(uses);
    const saved = collapseBlocks(asReported(services), linkage);
    expect(pipelineOf(saved)[0]).toEqual(uses[0]);
    expect(pipelineOf(saved)[2]).toEqual(uses[2]);
    expect(pipelineOf(saved)[3]).toEqual(uses[3]);
    // Everything around the uses is what the runtime reported.
    expect(pipelineOf(saved)[1].state).toEqual({ bypass: false, running: false });
    expect(source).toEqual(bar(uses));
  });

  it("writes a use back whatever is running inside it", () => {
    const { services, linkage } = link(uses);
    const reported = asReported(services);
    pipelineOf(reported)[0].state.pipeline[1].state.oneShotDelay = 0.25;
    expect(pipelineOf(collapseBlocks(reported, linkage))[0]).toEqual(uses[0]);
  });

  it("keeps the name a use was renamed to", () => {
    const { services, linkage } = link(uses);
    const reported = asReported(services);
    pipelineOf(reported)[0].serviceName = "Kick";
    expect(pipelineOf(collapseBlocks(reported, linkage))[0]).toEqual({ ...uses[0], serviceName: "Kick" });
  });

  it("finds a use after a service was inserted before it", () => {
    const { services, linkage } = link(uses);
    const reported = asReported(services);
    pipelineOf(reported).unshift({ serviceId: "monitor", instanceId: "new", state: {} });
    expect(pipelineOf(collapseBlocks(reported, linkage))[1]).toEqual(uses[0]);
  });

  it("writes whatever replaced a removed use as it is", () => {
    const { services, linkage } = link(uses);
    const reported = asReported(services);
    pipelineOf(reported).splice(0, 1);
    const saved = collapseBlocks(reported, linkage);
    expect(pipelineOf(saved)).toHaveLength(3);
    expect(pipelineOf(saved)[1]).toEqual(uses[2]);
  });
});

describe("params on a running use", () => {
  it("re-instantiates the use and saves the new params", () => {
    const { services, linkage } = link([{ block: "note", instanceId: "kick", params: { trigger: "kick" } }]);
    const placed = blockUseAt(linkage, "bar.kick")!;
    const changed = withUseParams(linkage, placed.key, { trigger: "snare", volume: 0.7 });
    expect(changed.service.state.pipeline[0].state).toEqual({ trigger: "snare", volume: 0.7 });
    expect(changed.service.instanceId).toBe("kick");
    const saved = collapseBlocks(asReported(services), changed.linkage);
    expect(pipelineOf(saved)[0]).toEqual({
      block: "note",
      instanceId: "kick",
      params: { trigger: "snare", volume: 0.7 },
    });
  });

  it("replaces the uses nested in it", () => {
    const { linkage } = link([{ block: "beat", instanceId: "b1", params: { accent: 0.8 } }]);
    const outer = blockUseAt(linkage, "bar.b1")!;
    const changed = withUseParams(linkage, outer.key, { accent: 0.2 });
    expect(changed.service.state.pipeline[0].state.pipeline[0].state.volume).toBe(0.2);
    const inner = changed.linkage.placed.filter((entry) => entry.parent === outer.key);
    expect(inner.map((entry) => entry.address)).toEqual(["bar.b1.on", "bar.b1.off"]);
    expect(changed.linkage.placed).toHaveLength(3);
    expect(inner[0].use.params).toEqual({ volume: 0.2 });
  });

  it("reports a parameter the block does not declare", () => {
    const { linkage } = link([{ block: "note", instanceId: "kick" }]);
    const { diagnostics } = withUseParams(linkage, blockUseAt(linkage, "bar.kick")!.key, { pitch: 1 });
    expect(diagnostics).toMatchObject([{ code: "block-param-undeclared" }]);
  });
});

describe("the inside of a use", () => {
  it("is what an address reaching past a use names", () => {
    const { linkage } = link([{ block: "beat", instanceId: "b1" }]);
    expect(blockUseContaining(linkage, "bar.b1.on.wait")?.address).toMatch(/^bar\.b1/);
    expect(blockUseContaining(linkage, "bar.b1")).toBeUndefined();
    expect(blockUseContaining(linkage, "bar")).toBeUndefined();
    expect(blockUseAt(linkage, "bar.b1")?.use.block).toBe("beat");
  });
});

describe("detaching", () => {
  it("saves a detached use as whatever is running, and the uses inside it still as uses", () => {
    const { services, linkage } = link([{ block: "beat", instanceId: "b1" }]);
    const detached = detachUse(linkage, blockUseAt(linkage, "bar.b1")!.key);
    const reported = asReported(services);
    pipelineOf(reported)[0].state.pipeline[1].state.pipeline[1].state.oneShotDelay = 0.25;
    const [copy] = pipelineOf(collapseBlocks(reported, detached));
    expect(copy.serviceId).toBe("sub-service");
    expect(copy.state.pipeline).toEqual([
      { block: "note", instanceId: "on", params: { volume: 0.5 } },
      { block: "note", instanceId: "off", params: { volume: 0.3 } },
    ]);
    expect(outermostUses(detached).map((entry) => entry.address)).toEqual([
      "bar.b1.on",
      "bar.b1.off",
    ]);
  });

  it("refuses a use inside an attached use", () => {
    const { linkage } = link([{ block: "beat", instanceId: "b1" }]);
    expect(() => detachUse(linkage, blockUseAt(linkage, "bar.b1.on")!.key)).toThrow(/inside another use/);
  });
});

describe("finding and making", () => {
  it("finds an entry's path by its address, through any container", () => {
    const services = {
      ui: [
        {
          uuid: "groove",
          serviceId: "sub-service",
          state: {
            pipeline: [
              {
                instanceId: "patterns",
                serviceId: "switch",
                state: { cases: [{ pipeline: [{ instanceId: "straight", serviceId: "sub-service" }] }] },
              },
            ],
          },
        },
      ],
    };
    expect(findEntryPath(services as any, "groove.patterns.straight")).toEqual([
      "ui",
      { id: "groove" },
      "state",
      "pipeline",
      { id: "patterns" },
      "state",
      "cases",
      0,
      "pipeline",
      { id: "straight" },
    ]);
    expect(findEntryPath(services as any, "groove.nothing")).toBeUndefined();
  });

  it("places a new use and saves it as the use", () => {
    const empty: BlockLinkage = { definitions, placed: [] };
    const { linkage, service } = withNewUse(empty, {
      runtimeId: "ui",
      document: "",
      arrayPath: ["ui"],
      use: { block: "beat", uuid: "b" },
      id: "b",
    });
    expect(service).toMatchObject({ uuid: "b", serviceName: "Beat" });
    expect(linkage.placed.map((entry) => entry.address).sort()).toEqual(["b", "b.off", "b.on"]);
    const saved = collapseBlocks({ ui: [service as any] }, linkage);
    expect(saved.ui).toEqual([{ block: "beat", uuid: "b" }]);
  });

  it("makes a block of a service, which becomes its first use", () => {
    const { services, linkage } = link([
      { serviceId: "sub-service", instanceId: "pair", state: { pipeline: [{ block: "note", instanceId: "n" }] } },
    ]);
    const path = findEntryPath(services, "bar.pair")!;
    const made = withBlockFrom(linkage, {
      runtimeId: "ui",
      document: "",
      path,
      definition: {
        id: "pair",
        name: "Pair",
        serviceId: "sub-service",
        state: { pipeline: [{ block: "note", instanceId: "n" }] },
      },
    });
    expect(made.definitions[""].map((entry) => entry.id)).toEqual(["note", "beat", "pair"]);
    const pair = blockUseAt(made, "bar.pair")!;
    expect(pair.use).toEqual({ block: "pair", instanceId: "pair" });
    // The use that was already inside it is now inside this one.
    expect(blockUseAt(made, "bar.pair.n")!.parent).toBe(pair.key);
    expect(pipelineOf(collapseBlocks(services, made))).toEqual([{ block: "pair", instanceId: "pair" }]);
  });

  it("refuses a block id that is taken", () => {
    const { services, linkage } = link([{ serviceId: "sub-service", instanceId: "x", state: {} }]);
    expect(() =>
      withBlockFrom(linkage, {
        runtimeId: "ui",
        document: "",
        path: findEntryPath(services, "bar.x")!,
        definition: { id: "note", name: "Note", serviceId: "sub-service", state: {} },
      }),
    ).toThrow(/already exists/);
  });
});

describe("editing a definition on a working copy", () => {
  it("keeps parameter references where they were, and a changed value becomes the use's param", () => {
    const running = {
      scope: { slots: "inherit" },
      pipeline: [
        // An edited param-driven field, and a new service added in the copy.
        { serviceId: "hookup.to/service/sound", instanceId: "hit", state: { trigger: "snare", volume: 0.5, bypass: false } },
        { serviceId: "hookup.to/service/timer", instanceId: "wait", state: { oneShotDelay: 0.5, oneShotDelayUnit: "ms" } },
        { serviceId: "monitor", instanceId: "added", state: {} },
      ],
      __hkpMount: "http://x/hosted/1",
    };
    const { definition, params, warnings } = definitionFromWorkingCopy(note, { trigger: "kick" }, running);
    expect(warnings).toEqual([]);
    expect(params).toEqual({ trigger: "snare" });
    expect(definition.state).toEqual({
      scope: { slots: "inherit" },
      pipeline: [
        { serviceId: "hookup.to/service/sound", instanceId: "hit", state: { trigger: "{{param.trigger}}", volume: "{{param.volume}}", bypass: false } },
        { serviceId: "hookup.to/service/timer", instanceId: "wait", state: { oneShotDelay: "{{param.beats}}", oneShotDelayUnit: "ms" } },
        { serviceId: "monitor", instanceId: "added", state: {} },
      ],
    });
  });

  it("drops a reference whose place was removed, and says so", () => {
    const running = { scope: { slots: "inherit" }, pipeline: [] };
    const { warnings } = definitionFromWorkingCopy(note, {}, running);
    expect(warnings).toHaveLength(3);
  });

  it("refreshes every use of the block through the outermost use containing it", () => {
    const { linkage } = link([
      { block: "beat", instanceId: "b1" },
      { block: "note", instanceId: "n" },
    ]);
    expect(usesToRefresh(linkage, "note", "").map((entry) => entry.address).sort()).toEqual([
      "bar.b1",
      "bar.n",
    ]);
  });

  it("opens the working copy's inside to addresses, and only that one's", () => {
    const { linkage } = link([{ block: "beat", instanceId: "b1" }]);
    const editing = { ...linkage, editing: blockUseAt(linkage, "bar.b1")!.key };
    expect(blockUseContaining(editing, "bar.b1.on")).toBeUndefined();
    // The use inside the copy is still a use, and its inside still closed.
    expect(blockUseContaining(editing, "bar.b1.on.hit")?.address).toBe("bar.b1.on");
  });
});
