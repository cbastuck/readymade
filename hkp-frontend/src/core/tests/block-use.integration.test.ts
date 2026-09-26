import { describe, expect, it, vi } from "vitest";

import BrowserRuntimeScope from "../../runtime/browser/BrowserRuntimeScope";
import BrowserRegistry from "../../runtime/browser/BrowserRegistry";
import browserApi, { getServiceConfig } from "../../runtime/browser/BrowserRuntimeApi";
import { addService } from "../serviceOperations";
import { setBlockParams } from "../blockActions";
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
    }) as unknown as BoardContextState;
  return { scope, refs, services, setLinkage, context, linkage: () => linkage! };
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
    await setBlockParams(key, { trigger: "snare", volume: 0.9 }, context(), setLinkage);

    expect(await soundOf(scope, svc!.uuid)).toMatchObject({ trigger: "snare", volume: 0.9 });
    const running = { [runtime.id]: [{ ...svc!, state: await getServiceConfig(scope as any, svc!) }] };
    expect(collapseBlocks(running as any, linkage().blocks!)[runtime.id]).toEqual([
      { block: "note", uuid: svc!.uuid, params: { trigger: "snare", volume: 0.9 } },
    ]);
  });
});
