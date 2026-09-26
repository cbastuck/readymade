import { describe, expect, it } from "vitest";

import {
  COLUMN_SPACING,
  LAYER_SPACING,
  ROW_SPACING,
  OverviewNode,
  buildScene,
} from "../graph";
import { RuntimeDescriptor, ServiceDescriptor } from "hkp-frontend/src/types";

/** The node a service is, found by its own name — unique in these boards. */
const named = (scene: { nodes: OverviewNode[] }, uuid: string) =>
  scene.nodes.find((n) => n.uuid === uuid);

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

    expect(named(scene, "a")!.x).toBe(0);
    expect(named(scene, "b")!.x).toBe(0);
    expect(named(scene, "c")!.x).toBe(COLUMN_SPACING);
    expect(named(scene, "b")!.y - named(scene, "a")!.y).toBe(
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
    expect(named(scene, "c")!.y).toBe(named(scene, "b")!.y);
    expect(scene.runtimes[1].y).toBe(named(scene, "c")!.y - ROW_SPACING);
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
    expect(named(scene, "c")!.y).toBe(named(scene, "host")!.y);
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
    expect(named(scene, "inner")!.y).toBe(named(scene, "host")!.y);
    expect(named(scene, "deeper-host")!.y).toBe(
      named(scene, "inner")!.y + ROW_SPACING,
    );
    expect(named(scene, "deepest")!.y).toBe(
      named(scene, "deeper-host")!.y,
    );

    expect(named(scene, "host")!.z).toBe(0);
    expect(named(scene, "inner")!.z).toBe(LAYER_SPACING);
    expect(named(scene, "deepest")!.z).toBe(2 * LAYER_SPACING);
    // The host stays where it was; what it contains is placed behind it.
    expect(named(scene, "host")!.depth).toBe(0);
    expect(named(scene, "inner")!.depth).toBe(1);
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
    expect(scene.nodes.map((n) => n.uuid).sort()).toEqual([
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
    expect(named(scene, "keep-list")!.pipeline).toBe("onProcess");
    expect(named(scene, "serve-list")!.pipeline).toBe("onRequest");
    expect(named(scene, "insert")!.pipeline).toBe("keep");
    expect(named(scene, "delete")!.pipeline).toBe("drop");
    expect(named(scene, "carry")!.pipeline).toBe("reduce");
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
    expect(named(scene, "first")!.pipeline).toBe("cases 1");
    expect(named(scene, "second")!.pipeline).toBe("cases 2");
    expect(named(scene, "fallback")!.pipeline).toBe("default");
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
    expect(named(scene, "keep-list")!.y).toBe(named(scene, "serve")!.y);
    expect(named(scene, "serve-list")!.y).toBe(
      named(scene, "keep-list")!.y + ROW_SPACING,
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

    expect(named(scene, "leaf")!.ancestry).toEqual(["host", "mid"]);
    expect(named(scene, "host")!.ancestry).toEqual([]);
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
      to: "host.inner",
      kind: "contains",
    });
    expect(scene.edges).toContainEqual({
      from: "host",
      to: "after",
      kind: "sequence",
    });
    // A nested service is not wired to what follows its host.
    expect(
      scene.edges.some((e) => e.from === "host.inner" && e.to === "after"),
    ).toBe(false);
  });

  it("survives a board with nothing on it", () => {
    const scene = buildScene([], {});
    expect(scene.nodes).toEqual([]);
    expect(scene.radius).toBeGreaterThan(0);
  });

  it("tells apart services of the same name in two copies of one block", () => {
    // A block reused twice holds services of the same names; found by name
    // alone, one would stand in for the other — drawn in one place, and lit
    // whenever either ran.
    const beat = (uuid: string) => ({
      instanceId: uuid,
      serviceId: "sub-service",
      state: { pipeline: [{ instanceId: "hihat", serviceId: "sound" }] },
    });
    const scene = buildScene([runtime("ui", "Browser")], {
      ui: [service("bar", { state: { pipeline: [beat("beat-1"), beat("beat-2")] } })],
    });

    const hihats = scene.nodes.filter((n) => n.uuid === "hihat");
    expect(hihats.map((n) => n.key)).toEqual([
      "bar.beat-1.hihat",
      "bar.beat-2.hihat",
    ]);
    expect(scene.byKey.size).toBe(scene.nodes.length);
    expect(scene.edges).toContainEqual({
      from: "bar.beat-1",
      to: "bar.beat-1.hihat",
      kind: "contains",
    });
    expect(scene.edges).toContainEqual({
      from: "bar.beat-2",
      to: "bar.beat-2.hihat",
      kind: "contains",
    });
  });
});
