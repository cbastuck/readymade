import { afterEach, describe, expect, it, vi } from "vitest";

import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import { executeActions } from "../executeActions";

const processed: unknown[] = [];

vi.mock("../boardServices", () => ({
  findService: () => null,
  processService: (_ctx: unknown, uuid: string, payload: unknown) => {
    processed.push({ uuid, payload });
  },
}));

const boardContext = {
  scopes: {},
  services: {},
  runtimes: [],
} as unknown as BoardContextState;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("values generated when a facade action runs", () => {
  it("gives a persisted and forwarded event its identity and exact time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-29T07:15:30.000Z"));
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000001",
    );
    processed.length = 0;

    await executeActions({
      actions: [
        {
          type: "process",
          serviceUuid: "record",
          payload: {
            eventId: { $uuid: true },
            observedAt: { $now: true },
            value: "$$input",
          },
        },
      ],
      value: "118",
      boardContext,
      setState: () => {},
      state: {},
    });

    expect(processed).toEqual([
      {
        uuid: "record",
        payload: {
          eventId: "00000000-0000-4000-8000-000000000001",
          observedAt: "2026-09-29T07:15:30.000Z",
          value: "118",
        },
      },
    ]);
  });
});
