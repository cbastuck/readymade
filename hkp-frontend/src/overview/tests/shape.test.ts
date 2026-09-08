import { describe, expect, it, vi } from "vitest";

import { readBoardShape } from "../shape";
import { buildScene } from "../graph";
import {
  RuntimeApiMap,
  RuntimeDescriptor,
  RuntimeScope,
  ServiceDescriptor,
} from "hkp-frontend/src/types";

/**
 * A sub-pipeline built in this session is in the service, not in the
 * descriptor the board holds — which is why the overview has to ask for it
 * rather than read what it already has.
 */

const runtime = {
  id: "rt",
  name: "NodeJS 1",
  type: "rest",
} as unknown as RuntimeDescriptor;

/** What the board holds for a sub-service that has been given a pipeline
 *  since it was added: the state it was added with, and nothing since. */
const joinDescriptor = {
  uuid: "join-1",
  serviceId: "join",
  serviceName: "Join",
  state: { mode: "overwrite" },
} as unknown as ServiceDescriptor;

/** What that same service answers when it is asked. */
const joinReported = {
  mode: "overwrite",
  pipeline: [
    { serviceId: "map", instanceId: "map-1", state: { mode: "replace" } },
  ],
};

function source(
  getServiceConfig?: RuntimeApiMap[string]["getServiceConfig"],
  services: ServiceDescriptor[] = [joinDescriptor],
) {
  return {
    runtimes: [runtime],
    services: { rt: services },
    scopes: { rt: {} as RuntimeScope },
    runtimeApis: {
      rest: { getServiceConfig },
    } as unknown as RuntimeApiMap,
  };
}

describe("readBoardShape", () => {
  it("takes what the service reports over what the board holds", async () => {
    const shape = await readBoardShape(
      source(vi.fn().mockResolvedValue(joinReported)),
    );
    expect((shape.rt[0].state as any).pipeline).toHaveLength(1);
  });

  it("asks once per top-level service, whatever the nesting", async () => {
    const getServiceConfig = vi.fn().mockResolvedValue(joinReported);
    await readBoardShape(source(getServiceConfig));
    expect(getServiceConfig).toHaveBeenCalledTimes(1);
  });

  it("keeps what was restored when a service answers with nothing", async () => {
    const shape = await readBoardShape(
      source(vi.fn().mockResolvedValue(undefined)),
    );
    expect(shape.rt[0]).toBe(joinDescriptor);
  });

  it("loses one service's detail, not the board, when a call fails", async () => {
    const other = {
      uuid: "timer-1",
      serviceId: "timer",
      serviceName: "Timer",
    } as unknown as ServiceDescriptor;
    const getServiceConfig = vi
      .fn()
      .mockRejectedValueOnce(new Error("runtime gone"))
      .mockResolvedValueOnce({ running: true });

    const shape = await readBoardShape(
      source(getServiceConfig, [joinDescriptor, other]),
    );
    expect(shape.rt[0]).toBe(joinDescriptor);
    expect((shape.rt[1].state as any).running).toBe(true);
  });

  it("falls back to the descriptors for a runtime it cannot ask", async () => {
    const shape = await readBoardShape({ ...source(undefined) });
    expect(shape.rt[0]).toBe(joinDescriptor);
  });

  it("gives the scene the nesting the descriptors alone would not", async () => {
    const board = source(vi.fn().mockResolvedValue(joinReported));

    const flat = buildScene(board.runtimes, board.services);
    expect(flat.byUuid.get("map-1")).toBeUndefined();
    expect(flat.edges).toHaveLength(0);

    const nested = buildScene(board.runtimes, await readBoardShape(board));
    expect(nested.byUuid.get("map-1")!.ancestry).toEqual(["join-1"]);
    expect(nested.edges).toContainEqual({
      from: "join-1",
      to: "map-1",
      kind: "contains",
    });
  });
});
