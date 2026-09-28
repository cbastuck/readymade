import { describe, expect, it, vi } from "vitest";

import BrowserRuntimeScope from "../../runtime/browser/BrowserRuntimeScope";
import BrowserRegistry from "../../runtime/browser/BrowserRegistry";
import browserApi, {
  getServiceConfig,
  processRuntime,
} from "../../runtime/browser/BrowserRuntimeApi";
import { addService } from "../serviceOperations";
import { WrapRefused, wrapServices } from "../wrapActions";
import { collapseBlocks } from "../../runtime/board/blocks";
import type { BoardStateRefs } from "../boardContextTypes";
import type { BoardLinkage } from "../../runtime/board/units";
import type { FacadeDescriptor } from "../../facade/types";
import type { RuntimeDescriptor, ServiceDescriptor, ServiceInstance } from "../../types";

vi.mock("sonner", () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() } }));

/**
 * Wrapping a run of services on a real browser runtime — the two services the
 * Trigger Pad Recorder uses to turn a pad's actions into a hit — and checking
 * the board does what it did before, rather than that a mocked api was called.
 */

const runtime: RuntimeDescriptor = { id: "rt-wrap", name: "Browser", type: "browser" };

const asRef = <T,>(current: T) => ({ current });

async function board(facade?: FacadeDescriptor) {
  const registry = await BrowserRegistry.create();
  const scope = new BrowserRuntimeScope(runtime, registry);
  const services: Record<string, ServiceDescriptor[]> = { [runtime.id]: [] };
  let linkage: BoardLinkage | undefined = { units: [], views: [] };
  let currentFacade = facade;
  const refs = {
    runtimesRef: asRef([runtime]),
    servicesRef: asRef(services),
    scopesRef: asRef({ [runtime.id]: scope }),
    registryRef: asRef({}),
    propsRef: asRef({ runtimeApis: { browser: browserApi } }),
    get linkageRef() {
      return { current: linkage };
    },
    setLinkage: (update: any) => {
      linkage = typeof update === "function" ? update(linkage) : update;
    },
    setFacade: (update: any) => {
      currentFacade = typeof update === "function" ? update(currentFacade) : update;
    },
    setServices: (update: any) => {
      const next = typeof update === "function" ? update(services) : update;
      services[runtime.id] = next[runtime.id];
    },
  } as unknown as BoardStateRefs;

  const add = (uuid: string, serviceId: string, serviceName: string, state: object) =>
    addService({ serviceId, serviceName }, runtime, refs, {
      uuid,
      state,
    } as unknown as ServiceInstance);
  await add("pass", "hookup.to/service/map", "Pass", { template: { "=": "params" } });
  await add("on-a-hit", "hookup.to/service/filter", "On a hit", {
    conditions: ["params.actions.length > 0"],
  });
  await add("the-hit", "hookup.to/service/map", "The hit", {
    template: { "=": "params.actions[0]" },
  });
  await add("after", "hookup.to/service/map", "After", {
    template: { hit: { "=": "params" } },
  });

  const wrap = (uuids: string[], options?: Parameters<typeof wrapServices>[5]) =>
    wrapServices(
      runtime.id,
      uuids,
      refs,
      () => currentFacade,
      () => linkage,
      options,
    );
  const run = (params: unknown) => processRuntime(scope as any, params, null);
  return {
    scope,
    services,
    wrap,
    run,
    linkage: () => linkage!,
    facade: () => currentFacade,
  };
}

const ids = (services: Record<string, ServiceDescriptor[]>) =>
  services[runtime.id].map((svc) => svc.uuid);

describe("wrapping services in a browser runtime", () => {
  it("puts the run in one sub-service where it was, and the board does what it did", async () => {
    const { services, wrap, run, scope } = await board();
    const hit = { actions: ["kick", "snare"] };
    const before = { hit: await run(hit), none: await run({ actions: [] }) };
    expect(before.hit).toEqual({ hit: "kick" });

    const { wrapper } = await wrap(["the-hit", "on-a-hit"]);

    expect(ids(services)).toEqual(["pass", wrapper, "after"]);
    const config: any = await getServiceConfig(scope as any, { uuid: wrapper });
    expect(config.scope).toEqual({ slots: "inherit" });
    expect(
      config.pipeline.map((entry: any) => [entry.instanceId, entry.serviceName]),
    ).toEqual([
      ["on-a-hit", "On a hit"],
      ["the-hit", "The hit"],
    ]);
    expect(services[runtime.id][1].serviceName).toBe("On a hit + The hit");
    expect(await run(hit)).toEqual(before.hit);
    expect(await run({ actions: [] })).toEqual(before.none);
  });

  it("refuses a run with a gap, and changes nothing", async () => {
    const { services, wrap } = await board();
    await expect(wrap(["pass", "the-hit"])).rejects.toBeInstanceOf(WrapRefused);
    expect(ids(services)).toEqual(["pass", "on-a-hit", "the-hit", "after"]);
  });

  it("sends the facade's addresses into the run through the sub-service", async () => {
    const facade = {
      panels: [{ id: "p", layout: { type: "text", serviceUuid: "the-hit" } }],
    } as unknown as FacadeDescriptor;
    const { wrap, facade: current } = await board(facade);
    const { wrapper } = await wrap(["on-a-hit", "the-hit"]);
    expect((current() as any).panels[0].layout.serviceUuid).toBe(`${wrapper}.the-hit`);
  });

  it("refuses to make a block the facade reaches into", async () => {
    const facade = {
      panels: [{ id: "p", layout: { type: "text", serviceUuid: "the-hit" } }],
    } as unknown as FacadeDescriptor;
    const { services, wrap } = await board(facade);
    await expect(wrap(["on-a-hit", "the-hit"], { asBlock: true })).rejects.toBeInstanceOf(
      WrapRefused,
    );
    expect(ids(services)).toEqual(["pass", "on-a-hit", "the-hit", "after"]);
  });

  it("makes a block of the run, which the board saves as a use", async () => {
    const { services, wrap, run, linkage, scope } = await board();
    const { wrapper, block } = await wrap(["on-a-hit", "the-hit"], {
      asBlock: true,
      name: "Hit",
    });

    expect(block).toMatchObject({ id: "hit", name: "Hit", serviceId: services[runtime.id][1].serviceId });
    expect(block!.state.pipeline.map((entry: any) => entry.instanceId)).toEqual([
      "on-a-hit",
      "the-hit",
    ]);
    expect(linkage().blocks!.definitions[""]).toEqual([block]);

    const serialized = {
      [runtime.id]: await Promise.all(
        services[runtime.id].map(async (svc) => ({
          ...svc,
          state: await getServiceConfig(scope as any, svc),
        })),
      ),
    };
    const saved = collapseBlocks(serialized as any, linkage().blocks!) as any;
    expect(saved[runtime.id][1]).toEqual({ block: "hit", uuid: wrapper });
    expect(await run({ actions: ["clap"] })).toEqual({ hit: "clap" });
  });
});
