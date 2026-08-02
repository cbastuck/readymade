import { describe, expect, it } from "vitest";

import { forkBoard } from "../forkBoard";
import { BoardDescriptor } from "hkp-frontend/src/types";

/**
 * Forking a board.
 *
 * The point is that the copy is a board of its own. Runtime ids are what a
 * runtime server namespaces by, so a copy that kept them would provision over
 * the original's runtimes — an editor whose changes land on the deployed board.
 * Renaming the ids is only half of it: everything that names one has to be
 * renamed with it, or the copy is broken in the subtler way where it loads fine
 * and points at the wrong thing.
 */

const board = {
  boardName: "Doorbell",
  runtimes: [
    { id: "ui", name: "Browser", type: "browser" },
    { id: "node", name: "Node", type: "rest", url: "http://127.0.0.1:8080" },
  ],
  services: {
    ui: [
      {
        uuid: "btn-1",
        serviceId: "hookup.to/service/configurator",
        serviceName: "Configurator",
        state: {
          // Names a service on another runtime, by both ids.
          targetServiceUuid: "http-1",
          targetRuntime: "node",
          passThrough: false,
          pipeline: [
            {
              instanceId: "shape-1",
              serviceId: "map",
              serviceName: "Shape",
              state: { mode: "replace", template: { on: true } },
            },
          ],
        },
      },
    ],
    node: [
      {
        uuid: "http-1",
        serviceId: "http-server-subservices",
        state: { __hkpMount: "http://127.0.0.1:8080/hosted/abc123" },
      },
      {
        uuid: "client-1",
        serviceId: "http-client",
        state: { __hkpMount: "hkp-mount://node/http-1", path: "/ring" },
      },
    ],
  },
  facade: {
    layout: "single",
    panels: [
      {
        id: "main",
        layout: {
          direction: "column",
          items: [
            { type: "button", serviceUuid: "btn-1", label: "Ring" },
            { type: "monitor", serviceUuid: "http-1" },
          ],
        },
      },
    ],
  },
} as unknown as BoardDescriptor;

function fork(source: BoardDescriptor = board) {
  return forkBoard(source, { token: "f0rk" });
}

describe("what a fork renames", () => {
  it("gives every runtime a new id, keeping its name and url", () => {
    const { board: forked } = fork();

    expect(forked.runtimes.map((rt) => rt.id)).toEqual(["ui-f0rk", "node-f0rk"]);
    expect(forked.runtimes[1].name).toBe("Node");
    expect(forked.runtimes[1].url).toBe("http://127.0.0.1:8080");
  });

  it("keys the services by the new runtime ids", () => {
    const { board: forked } = fork();

    expect(Object.keys(forked.services)).toEqual(["ui-f0rk", "node-f0rk"]);
  });

  it("gives every service a new uuid", () => {
    const { board: forked } = fork();

    expect(forked.services["node-f0rk"].map((svc) => svc.uuid)).toEqual([
      "http-1-f0rk",
      "client-1-f0rk",
    ]);
  });

  it("renames services nested in a pipeline too", () => {
    // A pipeline entry is a service; nothing else in the board would keep its
    // id unique if the parent's changed and it did not.
    const { board: forked } = fork();

    const state = forked.services["ui-f0rk"][0].state as {
      pipeline: Array<{ instanceId: string; serviceId: string }>;
    };
    expect(state.pipeline[0].instanceId).toBe("shape-1-f0rk");
    // The service *class* is not an id and must survive untouched.
    expect(state.pipeline[0].serviceId).toBe("map");
  });

  it("leaves the service class ids alone", () => {
    const { board: forked } = fork();

    expect(forked.services["node-f0rk"].map((svc) => svc.serviceId)).toEqual([
      "http-server-subservices",
      "http-client",
    ]);
  });
});

describe("services nested inside services", () => {
  // Every runtime spells a nested service's id `instanceId` (hkp-node also
  // accepts `uuid`), and nesting has no depth limit — a sub-service holds a
  // pipeline of services, any of which can be another sub-service. The rename
  // follows the id fields wherever they are, so the container's own name
  // (`pipeline`, or anything a future service calls it) never matters.
  const nested = {
    boardName: "Nested",
    runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
    services: {
      ui: [
        { uuid: "sink-1", serviceId: "monitor" },
        {
          uuid: "outer-1",
          serviceId: "sub-service",
          state: {
            mode: "pipeline",
            pipeline: [
              {
                instanceId: "inner-1",
                serviceId: "sub-service",
                state: {
                  pipeline: [
                    {
                      instanceId: "deep-1",
                      serviceId: "hookup.to/service/configurator",
                      // Two levels down, pointing at a service at the top.
                      state: { targetServiceUuid: "sink-1", targetRuntime: "ui" },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  } as unknown as BoardDescriptor;

  it("renames a service nested two pipelines deep", () => {
    const { board: forked } = forkBoard(nested, { token: "f0rk" });

    const outer = forked.services["ui-f0rk"][1].state as {
      pipeline: Array<{ instanceId: string; state: { pipeline: Array<{ instanceId: string }> } }>;
    };
    expect(outer.pipeline[0].instanceId).toBe("inner-1-f0rk");
    expect(outer.pipeline[0].state.pipeline[0].instanceId).toBe("deep-1-f0rk");
  });

  it("repoints what that service targets", () => {
    const { board: forked } = forkBoard(nested, { token: "f0rk" });

    const deep = (
      forked.services["ui-f0rk"][1].state as {
        pipeline: Array<{
          state: { pipeline: Array<{ state: Record<string, unknown> }> };
        }>;
      }
    ).pipeline[0].state.pipeline[0].state;
    expect(deep.targetServiceUuid).toBe("sink-1-f0rk");
    expect(deep.targetRuntime).toBe("ui-f0rk");
  });

  it("renames a nested service that spells its id `uuid`", () => {
    // hkp-node's sub-service takes either spelling, so a board written against
    // it can carry the other one.
    const { board: forked } = forkBoard(
      {
        boardName: "Nested",
        runtimes: [{ id: "node", name: "Node", type: "rest" }],
        services: {
          node: [
            {
              uuid: "outer-1",
              serviceId: "sub-service",
              state: { pipeline: [{ uuid: "inner-1", serviceId: "monitor" }] },
            },
          ],
        },
      } as unknown as BoardDescriptor,
      { token: "f0rk" },
    );

    const state = forked.services["node-f0rk"][0].state as {
      pipeline: Array<{ uuid: string }>;
    };
    expect(state.pipeline[0].uuid).toBe("inner-1-f0rk");
  });
});

describe("what a fork repoints", () => {
  it("follows a service that targets another service and runtime", () => {
    // A Configurator pointing at the original's ids would configure the
    // original's services — the deployed ones.
    const { board: forked } = fork();

    expect(forked.services["ui-f0rk"][0].state).toMatchObject({
      targetServiceUuid: "http-1-f0rk",
      targetRuntime: "node-f0rk",
    });
  });

  it("follows a mount reference to the copy's own owner", () => {
    const { board: forked } = fork();

    const client = forked.services["node-f0rk"][1].state as Record<string, unknown>;
    expect(client.__hkpMount).toBe("hkp-mount://node-f0rk/http-1-f0rk");
    expect(client.path).toBe("/ring");
  });

  it("follows the facade's widgets, however deeply nested", () => {
    const { board: forked } = fork();

    const items = (
      forked.facade as unknown as {
        panels: Array<{ layout: { items: Array<{ serviceUuid: string }> } }>;
      }
    ).panels[0].layout.items;
    expect(items.map((item) => item.serviceUuid)).toEqual([
      "btn-1-f0rk",
      "http-1-f0rk",
    ]);
  });

  it("reports what it renamed", () => {
    const { renamed } = fork();

    expect(renamed.runtimes).toEqual({ ui: "ui-f0rk", node: "node-f0rk" });
    expect(renamed.services["http-1"]).toBe("http-1-f0rk");
    expect(renamed.services["shape-1"]).toBe("shape-1-f0rk");
  });
});

describe("what a fork leaves alone", () => {
  it("does not touch the original", () => {
    const before = JSON.stringify(board);

    fork();

    expect(JSON.stringify(board)).toBe(before);
  });

  it("keeps a published address as it is", () => {
    // An address may name something outside this board entirely, and a fork
    // has no basis for deciding it meant the copy. The owner's runtime
    // republishes its own address on load anyway.
    const { board: forked } = fork();

    expect(
      (forked.services["node-f0rk"][0].state as Record<string, unknown>)
        .__hkpMount,
    ).toBe("http://127.0.0.1:8080/hosted/abc123");
  });

  it("keeps a reference to something this board does not contain", () => {
    const { board: forked } = forkBoard(
      {
        ...board,
        services: {
          node: [
            {
              uuid: "client-1",
              serviceId: "http-client",
              state: { __hkpMount: "hkp-mount://elsewhere/svc-9" },
            },
          ],
        },
      } as unknown as BoardDescriptor,
      { token: "f0rk" },
    );

    expect(
      (forked.services["node-f0rk"][0].state as Record<string, unknown>)
        .__hkpMount,
    ).toBe("hkp-mount://elsewhere/svc-9");
  });

  it("does not rewrite strings that merely look like an id", () => {
    // Renaming is driven by field name, not by value: "node" is an ordinary
    // word, and a board full of them must survive being forked.
    const { board: forked } = forkBoard(
      {
        boardName: "Notes",
        runtimes: [{ id: "node", name: "Node", type: "rest" }],
        services: {
          node: [
            {
              uuid: "map-1",
              serviceId: "map",
              state: { template: { label: "node", note: "mon-1 is fine" } },
            },
          ],
        },
      } as unknown as BoardDescriptor,
      { token: "f0rk" },
    );

    expect(
      (forked.services["node-f0rk"][0].state as { template: unknown }).template,
    ).toEqual({ label: "node", note: "mon-1 is fine" });
  });
});

describe("naming the fork", () => {
  it("takes the original's name with a suffix", () => {
    expect(fork().board.boardName).toBe("Doorbell fork");
  });

  it("takes a name when one is given", () => {
    expect(
      forkBoard(board, { name: "Doorbell v2", token: "f0rk" }).board.boardName,
    ).toBe("Doorbell v2");
  });

  it("gives two forks of one board different ids", () => {
    const first = forkBoard(board);
    const second = forkBoard(board);

    expect(first.board.runtimes[0].id).not.toBe(second.board.runtimes[0].id);
  });
});
