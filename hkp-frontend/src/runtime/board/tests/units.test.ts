import { describe, expect, it } from "vitest";

import { deepClone } from "../traversal";
import {
  UnitBoard,
  hasErrors,
  parseUnitRef,
  projectUnits,
  qualifyRuntimeId,
  unitBaseName,
  resolveParams,
  topicsUsedBy,
  unitNameOf,
  unlinkProjection,
} from "../units";

/** A unit shaped like the SYN ones: a queue in, a queue out, a trailing stop. */
function unitBoard(
  name: string,
  options: {
    imports?: string[];
    exports?: string[];
    publishes?: string;
    consumes?: string;
    params?: Record<string, string>;
  } = {},
): UnitBoard {
  return {
    boardName: `SYN ${name}`,
    unit: {
      name,
      imports: options.imports,
      exports: options.exports,
      params: options.params,
    },
    runtimes: [
      { id: "intake", name: "1 · In", type: "rest", url: "http://127.0.0.1:8080" },
      { id: "review", name: "2 · Out", type: "rest", url: "http://127.0.0.1:8080" },
    ],
    services: {
      intake: [
        { uuid: "tick", serviceId: "timer", serviceName: "Timer", state: {} },
        ...(options.consumes
          ? [
              {
                uuid: "incoming",
                serviceId: "queue",
                serviceName: "Consume",
                state: { mode: "consume", topic: options.consumes },
              },
            ]
          : []),
        ...(options.publishes
          ? [
              {
                uuid: "outgoing",
                serviceId: "queue",
                serviceName: "Publish",
                state: { mode: "publish", topic: options.publishes },
              },
            ]
          : []),
        { uuid: "after-intake", serviceId: "stopper", serviceName: "Stop", state: {} },
      ],
      review: [
        { uuid: "refresh", serviceId: "timer", serviceName: "Timer", state: {} },
        { uuid: "after-review", serviceId: "stopper", serviceName: "Stop", state: {} },
      ],
    },
  };
}

const emptyComposition: UnitBoard = {
  boardName: "SYN",
  runtimes: [],
  services: {},
};

describe("unit references", () => {
  it("reads a file name and a scheme reference as relative alike", () => {
    expect(parseUnitRef("hotels.json")).toEqual({
      kind: "relative",
      value: "hotels.json",
    });
    expect(parseUnitRef("hkp-unit://hotels.json")).toEqual({
      kind: "relative",
      value: "hotels.json",
    });
  });

  it("keeps an absolute URL as one", () => {
    expect(parseUnitRef("https://example.com/hotels.json")).toEqual({
      kind: "absolute",
      value: "https://example.com/hotels.json",
    });
  });

  it("strips directories and the suffix off a document address", () => {
    expect(unitBaseName("boards/syn-hotels-unit-board.json")).toBe(
      "syn-hotels-unit-board",
    );
    expect(unitBaseName("hotels")).toBe("hotels");
  });

  it("names an instance after the entry, then the unit, then the document", () => {
    const board = unitBoard("hotels");
    expect(unitNameOf({ uri: "hotels.json", as: "hotels-eu" }, board)).toBe(
      "hotels-eu",
    );
    expect(unitNameOf({ uri: "whatever.json" }, board)).toBe("hotels");
    // Nothing declares a name: the address is the last resort, and never as
    // a bare file name — it prefixes runtime ids.
    expect(
      unitNameOf({ uri: "boards/hotels.json" }, { runtimes: [], services: {} }),
    ).toBe("hotels");
  });
});

describe("parameters", () => {
  it("substitutes a value and reports one it does not have", () => {
    const { value, missing } = resolveParams(
      { topic: "{{param.inTopic}}", db: "{{ param.database }}" },
      { inTopic: "booking.ready" },
    );
    expect(value).toEqual({ topic: "booking.ready", db: "{{ param.database }}" });
    expect(missing).toEqual(["database"]);
  });

  it("leaves an unresolved reference in place rather than blanking it", () => {
    const { value } = resolveParams({ topic: "{{param.missing}}" }, {});
    expect(value).toEqual({ topic: "{{param.missing}}" });
  });

  it("takes the composition's value over the unit's default", () => {
    const board = unitBoard("hotels", {
      params: { database: "syn-hotels" },
      consumes: "{{param.inTopic}}",
      imports: ["booking.ready"],
    });
    const { board: projected } = projectUnits(emptyComposition, [
      {
        entry: { uri: "hotels", params: { inTopic: "booking.ready" } },
        board,
        name: "hotels",
      },
    ]);
    expect(projected.services["hotels.intake"][1].state.topic).toBe(
      "booking.ready",
    );
  });
});

describe("projection", () => {
  const booking = unitBoard("booking", {
    exports: ["booking.ready"],
    publishes: "booking.ready",
  });
  const hotels = unitBoard("hotels", {
    imports: ["booking.ready"],
    consumes: "booking.ready",
  });

  const resolved = [
    { entry: { uri: "booking" }, board: booking, name: "booking" },
    { entry: { uri: "hotels" }, board: hotels, name: "hotels" },
  ];

  it("qualifies runtime ids and leaves service uuids alone", () => {
    const { board } = projectUnits(emptyComposition, resolved);

    expect(board.runtimes.map((rt) => rt.id)).toEqual([
      "booking.intake",
      "booking.review",
      "hotels.intake",
      "hotels.review",
    ]);
    // The collision that made a flat merge impossible is simply not one: the
    // same uuid in two different runtimes has always been legal.
    expect(board.services["booking.intake"].map((svc) => svc.uuid)).toContain(
      "after-intake",
    );
    expect(board.services["hotels.intake"].map((svc) => svc.uuid)).toContain(
      "after-intake",
    );
  });

  it("keeps each unit's own board name on its runtimes", () => {
    const { board } = projectUnits(emptyComposition, resolved);
    expect(board.runtimes.map((rt) => rt.boardName)).toEqual([
      "SYN booking",
      "SYN booking",
      "SYN hotels",
      "SYN hotels",
    ]);
  });

  it("records provenance so a save can split back", () => {
    const { board, units } = projectUnits(
      { ...emptyComposition, runtimes: [{ id: "glue", name: "Glue", type: "browser" }] },
      resolved,
    );
    const glue = board.runtimes.find((rt) => rt.id === "glue");
    expect(glue?.unit).toBeUndefined();
    const intake = board.runtimes.find((rt) => rt.id === "hotels.intake");
    expect(intake?.unit).toBe("hotels");
    expect(intake?.unitRuntimeId).toBe("intake");
    expect(units.map((unit) => unit.name)).toEqual(["booking", "hotels"]);
  });

  it("pins a runtime id when the entry asks, and applies overrides", () => {
    const { board, diagnostics } = projectUnits(emptyComposition, [
      {
        entry: {
          uri: "hotels",
          runtimes: { intake: { id: "public-intake", url: "https://prod:8080" } },
        },
        board: hotels,
        name: "hotels",
      },
    ]);
    const intake = board.runtimes.find((rt) => rt.id === "public-intake");
    expect(intake?.url).toBe("https://prod:8080");
    expect(board.services["public-intake"]).toBeDefined();
    // The other runtime is still prefixed; pinning is per runtime.
    expect(board.runtimes.map((rt) => rt.id)).toContain("hotels.review");
    expect(diagnostics.some((d) => d.code === "unit-runtime-collision")).toBe(false);
  });

  it("rejects a pin that collides with another runtime", () => {
    const { diagnostics } = projectUnits(emptyComposition, [
      {
        entry: { uri: "booking", runtimes: { intake: { id: "shared" } } },
        board: booking,
        name: "booking",
      },
      {
        entry: { uri: "hotels", runtimes: { intake: { id: "shared" } } },
        board: hotels,
        name: "hotels",
      },
    ]);
    expect(hasErrors(diagnostics)).toBe(true);
    expect(diagnostics.some((d) => d.code === "unit-runtime-collision")).toBe(true);
  });

  it("points a mount reference at the id the runtime ended up with", () => {
    const withMount: UnitBoard = {
      ...hotels,
      services: {
        ...hotels.services,
        review: [
          {
            uuid: "client",
            serviceId: "http-client",
            serviceName: "Client",
            state: { __hkpMount: "hkp-mount://intake/server" },
          },
        ],
      },
    };
    const { board } = projectUnits(emptyComposition, [
      { entry: { uri: "hotels" }, board: withMount, name: "hotels" },
    ]);
    expect(board.services["hotels.review"][0].state.__hkpMount).toBe(
      "hkp-mount://hotels.intake/server",
    );
  });

  it("collects one view per unit rather than merging facades", () => {
    const withFacade = { ...hotels, facade: { layout: "single", panels: [] } } as UnitBoard;
    const { views } = projectUnits(
      { ...emptyComposition, facade: { layout: "single", panels: [] } as any },
      [{ entry: { uri: "hotels" }, board: withFacade, name: "hotels" }],
    );
    expect(views.map((view) => view.id)).toEqual(["composition", "hotels"]);
    expect(views[1].runtimeIds).toEqual(["hotels.intake", "hotels.review"]);
  });
});

describe("declarations", () => {
  it("errors when an included unit imports what nothing exports", () => {
    const hotels = unitBoard("hotels", {
      imports: ["booking.ready"],
      consumes: "booking.ready",
    });
    const { diagnostics } = projectUnits(emptyComposition, [
      { entry: { uri: "hotels" }, board: hotels, name: "hotels" },
    ]);
    expect(
      diagnostics.find((d) => d.code === "unit-import-unsatisfied")?.level,
    ).toBe("error");
  });

  it("only warns about the composition's own open import", () => {
    const root: UnitBoard = {
      ...emptyComposition,
      unit: { name: "booking", imports: ["booking.quotes"] },
    };
    const { diagnostics } = projectUnits(root, []);
    expect(hasErrors(diagnostics)).toBe(false);
    expect(diagnostics.some((d) => d.code === "unit-import-open")).toBe(true);
  });

  it("is satisfied when another unit exports the topic", () => {
    const booking = unitBoard("booking", {
      exports: ["booking.ready"],
      publishes: "booking.ready",
    });
    const hotels = unitBoard("hotels", {
      imports: ["booking.ready"],
      consumes: "booking.ready",
    });
    const { diagnostics } = projectUnits(emptyComposition, [
      { entry: { uri: "booking" }, board: booking, name: "booking" },
      { entry: { uri: "hotels" }, board: hotels, name: "hotels" },
    ]);
    expect(hasErrors(diagnostics)).toBe(false);
  });

  it("catches a declaration nothing backs up", () => {
    // Exactly the state the two SYN sketches are in today.
    const hotels = unitBoard("hotels", {
      imports: ["booking.ready"],
      exports: ["booking.quotes"],
      consumes: "booking.ready",
    });
    const { diagnostics } = projectUnits(emptyComposition, [
      { entry: { uri: "hotels" }, board: hotels, name: "hotels" },
    ]);
    expect(
      diagnostics.some(
        (d) => d.code === "unit-export-unpublished" && d.message.includes("booking.quotes"),
      ),
    ).toBe(true);
  });

  it("warns about publishing to an undeclared topic", () => {
    const rogue = unitBoard("rogue", { publishes: "secret.channel" });
    const { diagnostics } = projectUnits(emptyComposition, [
      { entry: { uri: "rogue" }, board: rogue, name: "rogue" },
    ]);
    expect(diagnostics.some((d) => d.code === "unit-export-undeclared")).toBe(true);
  });

  it("finds a topic inside a nested pipeline", () => {
    const nested = {
      intake: [
        {
          uuid: "per-request",
          serviceId: "iterator",
          state: {
            pipeline: [
              {
                uuid: "hand-over",
                serviceId: "queue",
                state: { mode: "publish", topic: "booking.ready" },
              },
            ],
          },
        },
      ],
    };
    expect([...topicsUsedBy(nested).published]).toEqual(["booking.ready"]);
  });
});

describe("qualifyRuntimeId", () => {
  it("uses a separator that survives a URL path", () => {
    expect(qualifyRuntimeId("hotels", "intake")).toBe("hotels.intake");
    expect(qualifyRuntimeId("hotels", "intake")).not.toContain("/");
  });
});

describe("unlinking", () => {
  const hotels: UnitBoard = {
    boardName: "SYN Hotels",
    unit: { name: "hotels", params: { inTopic: "booking.ready" } },
    runtimes: [
      { id: "intake", name: "In", type: "rest", url: "http://127.0.0.1:8080" },
    ],
    services: {
      intake: [
        {
          uuid: "incoming",
          serviceId: "queue",
          serviceName: "Consume",
          state: { mode: "consume", topic: "{{param.inTopic}}", limit: 5 },
        },
      ],
    },
  };

  const entry = {
    uri: "syn-hotels-unit-board.json",
    as: "hotels",
    runtimes: { intake: { url: "https://prod:8080" } },
  };

  const link = () =>
    projectUnits({ boardName: "SYN", runtimes: [], services: {} }, [
      { entry, board: hotels, name: "hotels" },
    ]);

  it("puts the runtimes back under the ids the unit writes", () => {
    const { board, units } = link();
    const { composition, units: documents } = unlinkProjection(board, units);

    expect(composition.runtimes).toEqual([]);
    expect(composition.units).toEqual([entry]);
    expect(documents[0].board.runtimes.map((rt) => rt.id)).toEqual(["intake"]);
    expect(documents[0].board.services.intake).toHaveLength(1);
  });

  it("writes the parameter back, not the value it resolved to", () => {
    const { board, units } = link();
    // What the board is actually running with.
    expect(board.services["hotels.intake"][0].state.topic).toBe("booking.ready");

    const { units: documents } = unlinkProjection(board, units);
    expect(documents[0].board.services.intake[0].state.topic).toBe(
      "{{param.inTopic}}",
    );
  });

  it("does not bake the composition's url override into the unit", () => {
    const { board, units } = link();
    expect(board.runtimes[0].url).toBe("https://prod:8080");

    const { units: documents } = unlinkProjection(board, units);
    expect(documents[0].board.runtimes[0].url).toBe("http://127.0.0.1:8080");
  });

  it("keeps an edit somebody made", () => {
    const { board, units } = link();
    const edited = deepClone(board);
    edited.services["hotels.intake"][0].state.limit = 25;

    const { units: documents } = unlinkProjection(edited, units);
    const state = documents[0].board.services.intake[0].state;
    expect(state.limit).toBe(25);
    // …without dragging the rest of the same object along with it.
    expect(state.topic).toBe("{{param.inTopic}}");
  });

  it("leaves a runtime the composition owns with the composition", () => {
    const root: UnitBoard = {
      boardName: "SYN",
      runtimes: [{ id: "glue", name: "Glue", type: "browser" }],
      services: { glue: [] },
    };
    const { board, units } = projectUnits(root, [
      { entry, board: hotels, name: "hotels" },
    ]);
    const { composition, units: documents } = unlinkProjection(board, units);

    expect(composition.runtimes.map((rt) => rt.id)).toEqual(["glue"]);
    expect(documents[0].board.runtimes.map((rt) => rt.id)).toEqual(["intake"]);
  });

  it("carries no provenance into either document", () => {
    const { board, units } = link();
    const { composition, units: documents } = unlinkProjection(board, units);
    const all = [...composition.runtimes, ...documents[0].board.runtimes];
    for (const runtime of all) {
      expect(runtime.unit).toBeUndefined();
      expect(runtime.unitRuntimeId).toBeUndefined();
    }
  });
});
