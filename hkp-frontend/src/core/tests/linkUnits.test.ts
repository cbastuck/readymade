import { describe, expect, it, vi } from "vitest";

import { UnitBoard } from "../../runtime/board/units";
import { defaultUnitOrigin, isComposition, linkBoard } from "../linkUnits";

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
