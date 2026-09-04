import { describe, expect, it, vi } from "vitest";

import { UnitBoard } from "../../runtime/board/units";
import {
  chainUnitOrigins,
  defaultUnitOrigin,
  isUnitLinkError,
  nativeFileUnitOrigin,
  reportUnitDiagnostics,
  resolveUnitFileUrl,
  UnitLinkError,
  isComposition,
  linkBoard,
} from "../linkUnits";

vi.mock("sonner", () => ({ toast: { warning: vi.fn(), error: vi.fn() } }));

function unit(name: string, extra: Partial<UnitBoard> = {}): UnitBoard {
  return {
    boardName: `SYN ${name}`,
    unit: { name },
    runtimes: [
      { id: "intake", name: "In", type: "rest", url: "http://127.0.0.1:8080" },
    ],
    services: { intake: [] },
    ...extra,
  };
}

function originOf(boards: Record<string, UnitBoard>) {
  return defaultUnitOrigin((name) => boards[name] ?? null);
}

describe("linking", () => {
  it("leaves a board with no units as it is", async () => {
    const board = unit("hotels");
    const { board: linked, units } = await linkBoard(board, originOf({}));
    expect(units).toEqual([]);
    expect(linked.runtimes.map((rt) => rt.id)).toEqual(["intake"]);
  });

  it("resolves names against the origin and qualifies what it finds", async () => {
    const boards = { booking: unit("booking"), hotels: unit("hotels") };
    const root: UnitBoard = {
      boardName: "SYN",
      runtimes: [],
      services: {},
      units: [{ uri: "booking" }, { uri: "hotels" }],
    };

    const { board, units } = await linkBoard(root, originOf(boards));
    expect(board.runtimes.map((rt) => rt.id)).toEqual([
      "booking.intake",
      "hotels.intake",
    ]);
    expect(units.map((placed) => placed.uri)).toEqual(["booking", "hotels"]);
  });

  it("reports a reference the origin does not have", async () => {
    const root: UnitBoard = {
      boardName: "SYN",
      runtimes: [],
      services: {},
      units: [{ uri: "missing" }],
    };
    const { diagnostics } = await linkBoard(root, originOf({}));
    expect(diagnostics[0]).toMatchObject({
      level: "error",
      code: "unit-unresolved",
    });
  });

  it("instantiates one document twice under different names", async () => {
    const boards = { hotels: unit("hotels") };
    const root: UnitBoard = {
      boardName: "SYN",
      runtimes: [],
      services: {},
      units: [
        { uri: "hotels", as: "hotels-eu" },
        { uri: "hotels", as: "hotels-us" },
      ],
    };
    const { board } = await linkBoard(root, originOf(boards));
    expect(board.runtimes.map((rt) => rt.id)).toEqual([
      "hotels-eu.intake",
      "hotels-us.intake",
    ]);
  });

  it("resolves a unit that is itself a composition, composing the names", async () => {
    const boards = {
      hotels: unit("hotels"),
      suppliers: unit("suppliers", { units: [{ uri: "hotels" }] }),
    };
    const root: UnitBoard = {
      boardName: "SYN",
      runtimes: [],
      services: {},
      units: [{ uri: "suppliers" }],
    };
    const { board } = await linkBoard(root, originOf(boards));
    expect(board.runtimes.map((rt) => rt.id)).toEqual([
      "suppliers.intake",
      "suppliers.hotels.intake",
    ]);
  });

  it("stops a cycle instead of looping", async () => {
    const boards: Record<string, UnitBoard> = {
      a: unit("a", { units: [{ uri: "b" }] }),
      b: unit("b", { units: [{ uri: "a" }] }),
    };
    const root: UnitBoard = {
      boardName: "SYN",
      runtimes: [],
      services: {},
      units: [{ uri: "a" }],
    };
    const { diagnostics } = await linkBoard(root, originOf(boards));
    expect(diagnostics.some((d) => d.code === "unit-cycle")).toBe(true);
  });

  it("knows a composition from a plain board by what it declares", () => {
    expect(isComposition(unit("hotels"))).toBe(false);
    expect(isComposition(unit("hotels", { units: [{ uri: "x" }] }))).toBe(true);
  });
});

describe("origins", () => {
  it("tries each origin in turn and takes the first answer", async () => {
    const only = unit("hotels");
    const empty = { describe: () => "nowhere", load: async () => null };
    const chained = chainUnitOrigins(empty, originOf({ hotels: only }));

    expect(await chained.load({ kind: "relative", value: "hotels" })).toBe(only);
  });

  it("treats an origin that throws as one that does not have it", async () => {
    const only = unit("hotels");
    const broken = {
      describe: () => "broken",
      load: async () => {
        throw new Error("offline");
      },
    };
    const chained = chainUnitOrigins(broken, originOf({ hotels: only }));

    expect(await chained.load({ kind: "relative", value: "hotels" })).toBe(only);
  });

  it("says where it looked when a unit is missing", async () => {
    const root: UnitBoard = {
      boardName: "SYN",
      runtimes: [],
      services: {},
      units: [{ uri: "syn-hotels-unit-board.json" }],
    };
    const { diagnostics } = await linkBoard(root, originOf({}));
    expect(diagnostics[0].message).toContain("saved boards");
    expect(diagnostics[0].message).toContain("syn-hotels-unit-board");
  });
});

describe("a composition opened from a file", () => {
  const files: Record<string, UnitBoard> = {
    "file:///Users/me/boards/syn-hotels-unit-board.json": unit("hotels"),
  };
  const readFile = async (uri: string) => {
    const board = files[uri];
    if (!board) {
      throw new Error(`no such file: ${uri}`);
    }
    return JSON.stringify(board);
  };

  it("resolves a unit beside the file the composition came from", async () => {
    const origin = nativeFileUnitOrigin(
      "file:///Users/me/boards/syn-board.json",
      readFile,
    );
    const board = await origin.load({
      kind: "relative",
      value: "syn-hotels-unit-board.json",
    });
    expect(board?.boardName).toBe("SYN hotels");
  });

  it("accepts a plain path from the picker as readily as a file URL", async () => {
    const origin = nativeFileUnitOrigin("/Users/me/boards/syn-board.json", readFile);
    const board = await origin.load({
      kind: "relative",
      value: "syn-hotels-unit-board.json",
    });
    expect(board?.boardName).toBe("SYN hotels");
  });

  it("resolves the same way a copy into a library would", () => {
    expect(
      resolveUnitFileUrl(
        "/Users/me/boards/syn-board.json",
        "syn-hotels-unit-board.json",
      ),
    ).toBe("file:///Users/me/boards/syn-hotels-unit-board.json");
  });
});

describe("the error a failed link throws", () => {
  it("carries the board and the units that were not found", async () => {
    const root: UnitBoard = {
      boardName: "SYN",
      runtimes: [],
      services: {},
      units: [{ uri: "a.json" }, { uri: "b.json" }],
    };
    const { diagnostics } = await linkBoard(root, originOf({}));

    let thrown: unknown = null;
    try {
      reportUnitDiagnostics(diagnostics, root);
    } catch (err) {
      thrown = err;
    }

    expect(isUnitLinkError(thrown)).toBe(true);
    const failure = thrown as UnitLinkError;
    expect(failure.missing).toEqual(["a.json", "b.json"]);
    expect(failure.board).toBe(root);
  });

  it("is not mistaken for an ordinary failure", () => {
    expect(isUnitLinkError(new Error("something else"))).toBe(false);
  });
});

describe("a host that keeps its own board library", () => {
  it("resolves a unit the host saved, which local storage never saw", async () => {
    const library: Record<string, UnitBoard> = {
      "syn-hotels-unit-board": unit("hotels"),
    };
    // Exactly the shape boardPersistence builds: the host's store first, this
    // browser's second.
    const origin = defaultUnitOrigin(async (name) => library[name] ?? null);

    const found = await origin.load({
      kind: "relative",
      value: "syn-hotels-unit-board.json",
    });
    expect(found?.boardName).toBe("SYN hotels");
  });

  it("still finds one saved under the reference as written", async () => {
    const library: Record<string, UnitBoard> = {
      "syn-hotels-unit-board.json": unit("hotels"),
    };
    const origin = defaultUnitOrigin(async (name) => library[name] ?? null);
    expect(
      await origin.load({ kind: "relative", value: "syn-hotels-unit-board.json" }),
    ).not.toBeNull();
  });
});
