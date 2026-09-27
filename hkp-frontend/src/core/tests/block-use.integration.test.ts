import { describe, expect, it, vi } from "vitest";

import BrowserRuntimeScope from "../../runtime/browser/BrowserRuntimeScope";
import BrowserRegistry from "../../runtime/browser/BrowserRegistry";
import browserApi, { getServiceConfig } from "../../runtime/browser/BrowserRuntimeApi";
import { addService } from "../serviceOperations";
import {
  applyBlockEdit,
  cancelBlockEdit,
  editBlock,
  setBlockParams,
} from "../blockActions";
import { BlockDefinition, collapseBlocks } from "../../runtime/board/blocks";
import type { BoardStateRefs } from "../boardContextTypes";
import type { BoardContextState } from "../../BoardContext";
import type { BoardLinkage } from "../../runtime/board/units";
import type { RuntimeDescriptor, ServiceDescriptor } from "../../types";

vi.mock("sonner", () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() } }));

/**
 * A use of a block in a real browser runtime: added from the palette, varied
 * through its params, and written back as the use — rather than against a mocked
 * api, since what matters is what the running services actually hold.
 */

const runtime: RuntimeDescriptor = { id: "rt-blocks", name: "Browser", type: "browser" };

const note: BlockDefinition = {
  id: "note",
  name: "Note",
  serviceId: "sub-service",
  params: { trigger: "hihat", volume: 0.5 },
  state: {
    pipeline: [
      {
        serviceId: "hookup.to/service/sound",
        instanceId: "hit",
        state: { generator: "drums", trigger: "{{param.trigger}}", volume: "{{param.volume}}" },
      },
    ],
  },
};

const asRef = <T,>(current: T) => ({ current });

async function board() {
  const registry = await BrowserRegistry.create();
  const scope = new BrowserRuntimeScope(runtime, registry);
  const services: Record<string, ServiceDescriptor[]> = { [runtime.id]: [] };
  let linkage: BoardLinkage | undefined = {
    units: [],
    views: [],
    blocks: { definitions: { "": [note] }, placed: [] },
  };
  const setLinkage = (update: any) => {
    linkage = typeof update === "function" ? update(linkage) : update;
  };
  const refs = {
    runtimesRef: asRef([runtime]),
    servicesRef: asRef(services),
    scopesRef: asRef({ [runtime.id]: scope }),
    propsRef: asRef({ runtimeApis: { browser: browserApi } }),
    get linkageRef() {
      return { current: linkage };
    },
    setLinkage,
    setServices: (update: any) => {
      const next = typeof update === "function" ? update(services) : update;
      services[runtime.id] = next[runtime.id];
    },
  } as unknown as BoardStateRefs;
  const context = () =>
    ({
      scopes: { [runtime.id]: scope },
      services,
      runtimes: [runtime],
      linkage,
      runtimeApis: { browser: browserApi },
      // The board as saving reads it: every service with what it holds now.
      serializeBoard: async () => ({
        runtimes: [runtime],
        services: {
          [runtime.id]: await Promise.all(
            services[runtime.id].map(async (svc) => ({
              ...svc,
              state: await getServiceConfig(scope as any, svc),
            })),
          ),
        },
      }),
    }) as unknown as BoardContextState;
  return { scope, refs, services, setLinkage, context, linkage: () => linkage! };
}

/** The live sub-service a use expanded to. */
function instanceOf(scope: BrowserRuntimeScope, uuid: string): any {
  return (scope as any).findServiceInstance(uuid)[0];
}

async function configOf(scope: BrowserRuntimeScope, uuid: string): Promise<any> {
  await instanceOf(scope, uuid)._scopeBuilding;
  return getServiceConfig(scope as any, { uuid });
}

async function soundOf(scope: BrowserRuntimeScope, uuid: string) {
  const config: any = await getServiceConfig(scope as any, { uuid });
  return config.pipeline[0].state;
}

describe("a use of a block in a browser runtime", () => {
  it("is created as what it expands to, and saved as the use", async () => {
    const { scope, refs, services, linkage } = await board();
    const svc = await addService(
      { serviceId: "sub-service", serviceName: "Note", block: { id: "note" } },
      runtime,
      refs,
    );
    expect(svc?.serviceName).toBe("Note");
    expect(await soundOf(scope, svc!.uuid)).toMatchObject({ trigger: "hihat", volume: 0.5 });

    const running = { [runtime.id]: [{ ...svc!, state: await getServiceConfig(scope as any, svc!) }] };
    expect(collapseBlocks(running as any, linkage().blocks!)[runtime.id]).toEqual([
      { block: "note", uuid: svc!.uuid },
    ]);
    expect(services[runtime.id]).toHaveLength(1);
  });

  it("takes new params into the running service and into what is saved", async () => {
    const { scope, refs, setLinkage, context, linkage } = await board();
    const svc = await addService(
      { serviceId: "sub-service", serviceName: "Note", block: { id: "note" } },
      runtime,
      refs,
    );
    const key = linkage().blocks!.placed[0].key;
    await setBlockParams(key, { trigger: "snare", volume: 0.9 }, context(), linkage, setLinkage);

    expect(await soundOf(scope, svc!.uuid)).toMatchObject({ trigger: "snare", volume: 0.9 });
    const running = { [runtime.id]: [{ ...svc!, state: await getServiceConfig(scope as any, svc!) }] };
    expect(collapseBlocks(running as any, linkage().blocks!)[runtime.id]).toEqual([
      { block: "note", uuid: svc!.uuid, params: { trigger: "snare", volume: 0.9 } },
    ]);
  });

  it("keeps the params a use has when one of them changes", async () => {
    const { scope, refs, setLinkage, context, linkage } = await board();
    const svc = await addService(
      { serviceId: "sub-service", serviceName: "Note", block: { id: "note" } },
      runtime,
      refs,
    );
    const key = linkage().blocks!.placed[0].key;
    await setBlockParams(key, { trigger: "snare" }, context(), linkage, setLinkage);
    await setBlockParams(key, { volume: 0.9 }, context(), linkage, setLinkage);

    expect(await soundOf(scope, svc!.uuid)).toMatchObject({ trigger: "snare", volume: 0.9 });
    expect(linkage().blocks!.placed[0].use.params).toEqual({ trigger: "snare", volume: 0.9 });
  });

  it("lands changes to two uses made while each other's were on their way", async () => {
    const { scope, refs, setLinkage, context, linkage } = await board();
    const use = { serviceId: "sub-service", serviceName: "Note", block: { id: "note" } };
    const first = await addService(use, runtime, refs);
    const second = await addService(use, runtime, refs);
    const [a, b] = linkage().blocks!.placed.map((entry) => entry.key);

    await Promise.all([
      setBlockParams(a, { trigger: "snare" }, context(), linkage, setLinkage),
      setBlockParams(b, { trigger: "kick" }, context(), linkage, setLinkage),
    ]);

    expect(await soundOf(scope, first!.uuid)).toMatchObject({ trigger: "snare" });
    expect(await soundOf(scope, second!.uuid)).toMatchObject({ trigger: "kick" });
    const params = Object.fromEntries(
      linkage().blocks!.placed.map((entry) => [entry.key, entry.use.params]),
    );
    expect(params).toEqual({ [a]: { trigger: "snare" }, [b]: { trigger: "kick" } });
  });
});

describe("a change of params that outlived its board", () => {
  it("is not applied when the board it was made on is gone", async () => {
    const { scope, refs, setLinkage, context, linkage } = await board();
    const svc = await addService(
      { serviceId: "sub-service", serviceName: "Note", block: { id: "note" } },
      runtime,
      refs,
    );
    const key = linkage().blocks!.placed[0].key;

    await setBlockParams(key, { trigger: "snare" }, context(), linkage, setLinkage, () => false);

    expect(await soundOf(scope, svc!.uuid)).toMatchObject({ trigger: "hihat" });
    expect(linkage().blocks!.placed[0].use.params).toBeUndefined();
  });

  it("is not saved when its board went while the service was answering", async () => {
    const { refs, setLinkage, context, linkage } = await board();
    await addService(
      { serviceId: "sub-service", serviceName: "Note", block: { id: "note" } },
      runtime,
      refs,
    );
    const key = linkage().blocks!.placed[0].key;
    // Current when the change starts, gone by the time the service answered.
    let asked = 0;
    const isCurrent = () => asked++ === 0;

    await setBlockParams(key, { trigger: "snare" }, context(), linkage, setLinkage, isCurrent);

    expect(asked).toBe(2);
    expect(linkage().blocks!.placed[0].use.params).toBeUndefined();
  });
});

describe("editing a block on one of its uses", () => {
  async function twoUses() {
    const built = await board();
    const use = { serviceId: "sub-service", serviceName: "Note", block: { id: "note" } };
    const working = await addService(use, runtime, built.refs);
    const other = await addService(use, runtime, built.refs);
    const [workingKey] = built.linkage().blocks!.placed.map((entry) => entry.key);
    editBlock(workingKey, built.setLinkage);
    return { ...built, working: working!, other: other! };
  }

  it("takes out of every use what the edit took out of the block", async () => {
    const { scope, setLinkage, context, linkage, working, other } = await twoUses();
    // The working copy's sound is replaced by a timer.
    await instanceOf(scope, working.uuid).configure({
      pipeline: [{ serviceId: "hookup.to/service/timer", instanceId: "wait", state: { oneShotDelay: 20 } }],
    });

    await applyBlockEdit(context(), setLinkage);

    for (const uuid of [working.uuid, other.uuid]) {
      const pipeline = (await configOf(scope, uuid)).pipeline;
      expect(pipeline.map((entry: any) => entry.instanceId)).toEqual(["wait"]);
      expect(pipeline[0].serviceId).toBe("hookup.to/service/timer");
      expect(pipeline[0].state).toMatchObject({ oneShotDelay: 20 });
      expect(pipeline[0].state).not.toHaveProperty("trigger");
    }
    expect(linkage().blocks!.editing).toBeUndefined();
  });

  it("puts back on cancel what the working copy changed the block says nothing about", async () => {
    const { scope, setLinkage, context, linkage, working } = await twoUses();
    // `note` says nothing about stopPropagation: false is what it means.
    await instanceOf(scope, working.uuid).configure({ stopPropagation: true, pipeline: [] });
    expect((await configOf(scope, working.uuid)).stopPropagation).toBe(true);

    await cancelBlockEdit(context(), setLinkage);

    const config = await configOf(scope, working.uuid);
    expect(config.stopPropagation).toBe(false);
    expect(config.pipeline.map((entry: any) => entry.instanceId)).toEqual(["hit"]);
    expect(config.pipeline[0].state).toMatchObject({ trigger: "hihat", volume: 0.5 });
    expect(linkage().blocks!.editing).toBeUndefined();
  });
});
