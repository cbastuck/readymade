import { describe, expect, it } from "vitest";

import {
  COLUMN_SPACING,
  LAYER_SPACING,
  ROW_SPACING,
  buildScene,
} from "../graph";
import { RuntimeDescriptor, ServiceDescriptor } from "hkp-frontend/src/types";

const runtime = (id: string, name: string): RuntimeDescriptor =>
  ({ id, name, type: "browser" }) as unknown as RuntimeDescriptor;

const service = (uuid: string, extra: object = {}): ServiceDescriptor =>
  ({
    uuid,
    serviceId: `hookup.to/service/${uuid}`,
    serviceName: uuid,
    ...extra,
  }) as unknown as ServiceDescriptor;

describe("buildScene", () => {
  it("places runtimes across X and services down Y", () => {
    const scene = buildScene(
      [runtime("ui", "Browser"), runtime("node", "Node")],
      { ui: [service("a"), service("b")], node: [service("c")] },
    );

    expect(scene.byUuid.get("a")!.x).toBe(0);
    expect(scene.byUuid.get("b")!.x).toBe(0);
    expect(scene.byUuid.get("c")!.x).toBe(COLUMN_SPACING);
    expect(scene.byUuid.get("b")!.y - scene.byUuid.get("a")!.y).toBe(
      ROW_SPACING,
    );
  });

  it("starts a runtime on the row the one before it handed over from", () => {
    const scene = buildScene(
      [runtime("ui", "Browser"), runtime("node", "Node")],
      { ui: [service("a"), service("b")], node: [service("c")] },
    );

    // Where the chain leaves one runtime is where the next one picks it up, so
    // the handoff is a step across rather than the height of the board.
    expect(scene.byUuid.get("c")!.y).toBe(scene.byUuid.get("b")!.y);
    expect(scene.runtimes[1].y).toBe(scene.byUuid.get("c")!.y - ROW_SPACING);
  });

  it("hands over from the last service a runtime itself holds", () => {
    const scene = buildScene(
      [runtime("ui", "Browser"), runtime("node", "Node")],
      {
        ui: [
          service("host", {
            state: { pipeline: [{ instanceId: "inner", serviceId: "x" }] },
          }),
        ],
        node: [service("c")],
      },
    );

    // The chain leaves from the host: what runs next is fed by the pipeline,
    // not by the scope, whatever the scope holds.
    expect(scene.byUuid.get("c")!.y).toBe(scene.byUuid.get("host")!.y);
  });

  it("puts a nested pipeline behind the service hosting it", () => {
    const scene = buildScene([runtime("ui", "Browser")], {
      ui: [
        service("host", {
          state: {
            pipeline: [
              { instanceId: "inner", serviceId: "x", state: {} },
              {
                instanceId: "deeper-host",
                serviceId: "y",
                state: {
                  pipeline: [{ instanceId: "deepest", serviceId: "z" }],
                },
              },
            ],
          },
        }),
      ],
    });

    // A pipeline starts level with the service holding it, a layer back, so
    // stepping into a service reads as a move in depth and nothing else.
    expect(scene.byUuid.get("inner")!.y).toBe(scene.byUuid.get("host")!.y);
    expect(scene.byUuid.get("deeper-host")!.y).toBe(
      scene.byUuid.get("inner")!.y + ROW_SPACING,
    );
    expect(scene.byUuid.get("deepest")!.y).toBe(
      scene.byUuid.get("deeper-host")!.y,
    );

    expect(scene.byUuid.get("host")!.z).toBe(0);
    expect(scene.byUuid.get("inner")!.z).toBe(LAYER_SPACING);
    expect(scene.byUuid.get("deepest")!.z).toBe(2 * LAYER_SPACING);
    // The host stays where it was; what it contains is placed behind it.
    expect(scene.byUuid.get("host")!.depth).toBe(0);
    expect(scene.byUuid.get("inner")!.depth).toBe(1);
  });

  it("finds every pipeline a service holds, whatever it files them under", () => {
    const scene = buildScene([runtime("node", "Node")], {
      node: [
        service("serve", {
          state: {
            mountName: "feed",
            onProcess: [{ instanceId: "keep-list", serviceId: "hold" }],
            onRequest: [{ instanceId: "serve-list", serviceId: "hold" }],
          },
        }),
        service("record", {
          state: {
            run: "serial",
            tracks: [
              {
                name: "keep",
                pipeline: [{ instanceId: "insert", serviceId: "sql" }],
              },
              {
                name: "drop",
                pipeline: [{ instanceId: "delete", serviceId: "sql" }],
              },
            ],
            reduce: [{ instanceId: "carry", serviceId: "hold" }],
          },
        }),
      ],
    });

    // An endpoint's two entry points, a track each, and what reduces them:
    // all of them are pipelines, and none of them is called `pipeline`.
    expect([...scene.byUuid.keys()].sort()).toEqual([
      "carry",
      "delete",
      "insert",
      "keep-list",
      "record",
      "serve",
      "serve-list",
    ]);

    // Which one a service is in, said by the name its host files it under —
    // the field, or what the thing holding it calls itself.
    expect(scene.byUuid.get("keep-list")!.pipeline).toBe("onProcess");
    expect(scene.byUuid.get("serve-list")!.pipeline).toBe("onRequest");
    expect(scene.byUuid.get("insert")!.pipeline).toBe("keep");
    expect(scene.byUuid.get("delete")!.pipeline).toBe("drop");
    expect(scene.byUuid.get("carry")!.pipeline).toBe("reduce");
  });

  it("tells apart pipelines the board leaves unnamed", () => {
    const scene = buildScene([runtime("ui", "Browser")], {
      ui: [
        service("switch", {
          state: {
            cases: [
              {
                when: "a",
                pipeline: [{ instanceId: "first", serviceId: "m" }],
              },
              {
                when: "b",
                pipeline: [{ instanceId: "second", serviceId: "m" }],
              },
            ],
            default: [{ instanceId: "fallback", serviceId: "m" }],
          },
        }),
      ],
    });

    // A case names itself by what it matches rather than by a name, so the
    // two are told apart by where they are in the list. Without that both
    // would answer to `pipeline`, and one plate would be drawn around both.
    expect(scene.byUuid.get("first")!.pipeline).toBe("cases 1");
    expect(scene.byUuid.get("second")!.pipeline).toBe("cases 2");
    expect(scene.byUuid.get("fallback")!.pipeline).toBe("default");
  });

  it("keeps a host's pipelines apart, in place and in what connects them", () => {
    const scene = buildScene([runtime("node", "Node")], {
      node: [
        service("serve", {
          state: {
            onProcess: [{ instanceId: "keep-list", serviceId: "hold" }],
            onRequest: [{ instanceId: "serve-list", serviceId: "hold" }],
          },
        }),
      ],
    });

    // Two runs, not one: nothing passes from the end of the first to the
    // start of the second, and they are not drawn on top of each other.
    expect(
      scene.edges.filter(
        (edge) => edge.from === "keep-list" && edge.to === "serve-list",
      ),
    ).toHaveLength(0);
    expect(
      scene.edges.filter(
        (edge) => edge.kind === "contains" && edge.from === "serve",
      ),
    ).toHaveLength(2);
    expect(scene.byUuid.get("keep-list")!.y).toBe(scene.byUuid.get("serve")!.y);
    expect(scene.byUuid.get("serve-list")!.y).toBe(
      scene.byUuid.get("keep-list")!.y + ROW_SPACING,
    );
  });

  it("records what has to be opened to reach a nested service", () => {
    const scene = buildScene([runtime("ui", "Browser")], {
      ui: [
        service("host", {
          state: {
            pipeline: [
              {
                instanceId: "mid",
                serviceId: "y",
                state: { pipeline: [{ instanceId: "leaf", serviceId: "z" }] },
              },
            ],
          },
        }),
      ],
    });

    expect(scene.byUuid.get("leaf")!.ancestry).toEqual(["host", "mid"]);
    expect(scene.byUuid.get("host")!.ancestry).toEqual([]);
  });

  it("chains the end of one runtime to the start of the next, skipping empty ones", () => {
    const scene = buildScene(
      [
        runtime("ui", "Browser"),
        runtime("empty", "Empty"),
        runtime("node", "Node"),
      ],
      { ui: [service("a"), service("b")], empty: [], node: [service("c")] },
    );

    const handoffs = scene.edges.filter((e) => e.kind === "handoff");
    expect(handoffs).toEqual([{ from: "b", to: "c", kind: "handoff" }]);
  });

  it("links a host to the pipeline it contains rather than in sequence", () => {
    const scene = buildScene([runtime("ui", "Browser")], {
      ui: [
        service("host", {
          state: { pipeline: [{ instanceId: "inner", serviceId: "x" }] },
        }),
        service("after"),
      ],
    });

    expect(scene.edges).toContainEqual({
      from: "host",
      to: "inner",
      kind: "contains",
    });
    expect(scene.edges).toContainEqual({
      from: "host",
      to: "after",
      kind: "sequence",
    });
    // A nested service is not wired to what follows its host.
    expect(
      scene.edges.some((e) => e.from === "inner" && e.to === "after"),
    ).toBe(false);
  });

  it("survives a board with nothing on it", () => {
    const scene = buildScene([], {});
    expect(scene.nodes).toEqual([]);
    expect(scene.radius).toBeGreaterThan(0);
  });
});
