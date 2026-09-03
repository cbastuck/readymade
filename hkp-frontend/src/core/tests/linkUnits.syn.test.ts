import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { UnitBoard, hasErrors } from "../../runtime/board/units";
import { defaultUnitOrigin, linkBoard } from "../linkUnits";

vi.mock("sonner", () => ({ toast: { warning: vi.fn(), error: vi.fn() } }));

const board = (file: string): UnitBoard =>
  JSON.parse(readFileSync(`boards/${file}`, "utf8"));

const composition = board("syn-board.json");
// Stands in for the saved-boards store, which keys documents by the base name
// they were imported under.
const origin = defaultUnitOrigin((name) => {
  const boards: Record<string, UnitBoard> = {
    "syn-booking-unit-board": board("syn-booking-unit-board.json"),
    "syn-hotels-unit-board": board("syn-hotels-unit-board.json"),
  };
  return boards[name] ?? null;
});

describe("the SYN composition", () => {
  it("links the two units into one board", async () => {
    const { board: linked, diagnostics } = await linkBoard(composition, origin);

    expect(linked.runtimes.map((rt) => rt.id)).toEqual([
      "booking.test",
      "booking.intake",
      "booking.dispatch",
      "booking.review",
      "booking.approve",
      "booking.reject",
      "hotels.intake",
      "hotels.review",
    ]);
    expect(hasErrors(diagnostics)).toBe(false);
  });

  it("leaves the uuid that would have collided in a flat merge alone", async () => {
    const { board: linked } = await linkBoard(composition, origin);
    const uuidsIn = (runtimeId: string) =>
      linked.services[runtimeId].map((svc) => svc.uuid);

    expect(uuidsIn("booking.intake")).toContain("after-intake");
    expect(uuidsIn("hotels.intake")).toContain("after-intake");
    expect(uuidsIn("booking.review")).toContain("refresh");
    expect(uuidsIn("hotels.review")).toContain("refresh");
  });

  it("gives each unit's runtimes that unit's own board name", async () => {
    const { board: linked } = await linkBoard(composition, origin);
    const boardNames = new Set(linked.runtimes.map((rt) => rt.boardName));
    expect([...boardNames].sort()).toEqual(["SYN Booking", "SYN Hotels"]);
  });

  it("substitutes the topics both units were parameterised on", async () => {
    const { board: linked } = await linkBoard(composition, origin);

    const consume = linked.services["hotels.intake"].find(
      (svc) => svc.uuid === "incoming",
    );
    expect(consume?.state.topic).toBe("booking.ready");

    // Deep inside the dispatcher's request-quotes action.
    const dispatch = JSON.stringify(linked.services["booking.dispatch"]);
    expect(dispatch).toContain("'booking.quotes'");
    expect(dispatch).not.toContain("{{param.");
  });

  it("satisfies booking.ready across the two units", async () => {
    const { diagnostics } = await linkBoard(composition, origin);
    expect(
      diagnostics.filter((d) => d.message.includes("booking.ready")).map((d) => d.code),
    ).not.toContain("unit-import-unsatisfied");
  });

  it("reports the half of the interface neither unit implements yet", async () => {
    // hotels declares it exports booking.quotes and never publishes it;
    // booking declares it imports the same and never consumes it. Both are
    // true of the boards as they stand, and both are visible statically.
    const { diagnostics } = await linkBoard(composition, origin);
    const quotes = diagnostics
      .filter((entry) => entry.message.includes("booking.quotes"))
      .map((entry) => entry.code);

    expect(quotes).toContain("unit-export-unpublished");
    expect(quotes).toContain("unit-import-unconsumed");
    expect(hasErrors(diagnostics)).toBe(false);
  });

  it("runs a unit on its own, with its open import only a warning", async () => {
    const { board: alone, diagnostics } = await linkBoard(
      board("syn-booking-unit-board.json"),
      origin,
    );

    expect(alone.runtimes.map((rt) => rt.id)).toContain("intake");
    expect(hasErrors(diagnostics)).toBe(false);
    expect(diagnostics.some((d) => d.code === "unit-import-open")).toBe(true);
  });
});
