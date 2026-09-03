import { describe, expect, it } from "vitest";

import { BoardContextState } from "../../BoardContext";
import { findService, narrowBoardContext } from "../boardServices";

/** Two units that happen to use the same service uuid, as units freely may. */
const boardContext = {
  runtimes: [
    { id: "booking.review", name: "Booking", type: "rest", url: "http://x" },
    { id: "hotels.review", name: "Hotels", type: "rest", url: "http://x" },
  ],
  services: {
    "booking.review": [{ uuid: "refresh", serviceId: "timer", serviceName: "T" }],
    "hotels.review": [{ uuid: "refresh", serviceId: "timer", serviceName: "T" }],
  },
  scopes: {
    "booking.review": { app: {}, authenticatedUser: null },
    "hotels.review": { app: {}, authenticatedUser: null },
  },
  registry: { "booking.review": [], "hotels.review": [] },
} as unknown as BoardContextState;

describe("narrowBoardContext", () => {
  it("keeps only the runtimes a view may address", () => {
    const narrowed = narrowBoardContext(boardContext, ["hotels.review"]);

    expect(narrowed.runtimes.map((rt) => rt.id)).toEqual(["hotels.review"]);
    expect(Object.keys(narrowed.services)).toEqual(["hotels.review"]);
    expect(Object.keys(narrowed.scopes)).toEqual(["hotels.review"]);
  });

  it("resolves a uuid two units share to the one in view", () => {
    // Unnarrowed, the same uuid resolves to whichever runtime comes first.
    expect(findService(boardContext, "refresh")).not.toBeNull();

    const hotels = narrowBoardContext(boardContext, ["hotels.review"]);
    expect(findService(hotels, "refresh")).not.toBeNull();
    // The other unit's runtime is simply not there to be found.
    expect(hotels.runtimes.some((rt) => rt.id === "booking.review")).toBe(false);
  });

  it("leaves a view over the whole board untouched", () => {
    expect(narrowBoardContext(boardContext, [])).toBe(boardContext);
  });
});
