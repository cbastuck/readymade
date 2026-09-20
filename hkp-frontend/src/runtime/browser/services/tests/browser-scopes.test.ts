import { describe, expect, it, vi } from "vitest";

import HoldDescriptor from "../Hold";
import { BrowserSubService } from "../BrowserSubService";
import { createSlotStore } from "../../../slots";
import board from "../../../../../boards/hold-scopes-demo-board.json";

/**
 * A scope in the browser runtime: what it keeps to itself, what leaves it, and
 * what a board can name inside it.
 *
 * The demo board is the case this has to carry — two scopes on one runtime,
 * one running on its own schedule and passing nothing on, the other entered by
 * a button and answering from the cell the first one wrote.
 */

function makeApp(slots = createSlotStore()) {
  return {
    notify: vi.fn(),
    next: vi.fn(),
    sendAction: vi.fn(),
    slots: () => slots,
  } as any;
}

/** Every serviceUuid the facade mentions, however deeply nested. */
function referenced(node: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    node.forEach((child) => referenced(child, found));
    return found;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "serviceUuid" && typeof value === "string") {
        found.add(value);
      } else {
        referenced(value, found);
      }
    }
  }
  return found;
}

function scopeOf(uuid: string) {
  return (board.services.ui as any[]).find((svc) => svc.uuid === uuid);
}

describe("the Hold-across-scopes demo board", () => {
  it("is two scopes, and the ticker passes nothing on", () => {
    // What a Stopper between them would have said, said by the flow that ends.
    const ticker = scopeOf("ticker");
    expect(ticker.serviceId).toBe("sub-service");
    expect(ticker.state.stopPropagation).toBe(true);
    expect(scopeOf("reader").state.stopPropagation).toBeUndefined();
  });

  it("has both scopes hold in the runtime's cells", () => {
    // One slot name reaching across two scopes is the whole arrangement, and
    // it only works because both say they inherit. Left alone a scope keeps
    // its cells to itself, which would leave the reader answering nothing.
    for (const uuid of ["ticker", "reader"]) {
      expect(scopeOf(uuid).state.scope).toEqual({ slots: "inherit" });
    }
  });

  it("names the two ends of one slot", () => {
    const writer = scopeOf("ticker").state.pipeline.at(-1);
    const reader = scopeOf("reader").state.pipeline[0];
    expect(writer.state.op).toBe("write");
    expect(reader.state.op).toBe("read");
    expect(reader.state.slot).toBe(writer.state.slot);
  });

  it("addresses what it reads by the path through the scope holding it", () => {
    // A service inside a scope is named by where it sits, so moving one
    // between scopes is visible in the board rather than silent.
    expect([...referenced(board.facade)].sort()).toEqual([
      "reader",
      "reader.serve",
      "ticker.keep",
    ]);
  });
});

describe("a browser scope", () => {
  it("passes its result on unless it says otherwise", async () => {
    const scope = new BrowserSubService(makeApp(), "board", {} as any, "scope");
    scope.configure({ pipeline: [] });
    // An empty scope is a wire, which keeps a half-built board legible.
    expect(await scope.process({ mark: true })).toEqual({ mark: true });
  });

  it("answers nothing when it says it stops", async () => {
    const scope = new BrowserSubService(makeApp(), "board", {} as any, "scope");
    scope.configure({ stopPropagation: true, pipeline: [] });
    expect(await scope.process({ mark: true })).toBeNull();
  });

  it("reports what it keeps to itself, both fields, always", () => {
    // Reported even at their defaults, like the bypass beside them: a saved
    // board then says outright what each scope does with its answer and its
    // cells, instead of leaving a reader to infer a boundary.
    const scope = new BrowserSubService(makeApp(), "board", {} as any, "scope");
    expect(scope.state.stopPropagation).toBe(false);
    expect(scope.state.scope).toEqual({ slots: "own" });
  });
});

describe("two Holds naming one slot", () => {
  it("meet when the scopes around them inherit the runtime's cells", () => {
    // The demo board's arrangement, without the timer: the cell is what makes
    // a value produced on one schedule readable on another.
    const slots = createSlotStore();
    const writer = HoldDescriptor.create(
      makeApp(slots),
      "board",
      {} as any,
      "keep",
    ) as any;
    const reader = HoldDescriptor.create(
      makeApp(slots),
      "board",
      {} as any,
      "serve",
    ) as any;
    writer.configure({ slot: "latest", op: "write" });
    reader.configure({ slot: "latest", op: "read" });

    writer.process({ count: 3 });
    expect(reader.process(undefined)).toEqual({ count: 3 });
  });
});
