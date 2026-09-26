import { describe, expect, it, vi } from "vitest";

import HoldDescriptor from "../Hold";
import { BrowserSubService } from "../BrowserSubService";
import { createSlotStore } from "../../../slots";
import board from "../../../../../../boards/hold-scopes-demo-board.json";

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

describe("what a scope can say about its cells", () => {
  it("lists them, and reports a write or a removal to whoever is watching", () => {
    // What a panel needs of a store: everything in it, word that it changed —
    // a cell is written by whichever pipeline happens to run, not by the one
    // being looked at — and a way to take one away again.
    const slots = createSlotStore();
    const seen = vi.fn();
    const stop = slots.watch(seen);

    slots.set("latest", { triggerCount: 3 });
    expect(slots.entries()).toEqual([["latest", { triggerCount: 3 }]]);
    expect(seen).toHaveBeenCalledTimes(1);

    slots.remove("latest");
    expect(slots.entries()).toEqual([]);
    expect(seen).toHaveBeenCalledTimes(2);
    // Removing what is not there says nothing happened, because nothing did.
    slots.remove("latest");
    expect(seen).toHaveBeenCalledTimes(2);

    stop();
    slots.set("latest", { triggerCount: 4 });
    expect(seen).toHaveBeenCalledTimes(2);
    expect(slots.entries()).toEqual([["latest", { triggerCount: 4 }]]);
  });

  it("calls the cells inherited only when they are the ones around it", async () => {
    // Which store a scope reached, rather than what it asked for: the two
    // differ where a scope says `inherit` and nothing around it has cells.
    const runtimeSlots = createSlotStore();
    const inheriting = new BrowserSubService(
      makeApp(runtimeSlots),
      "board",
      {} as any,
      "reader",
    );
    inheriting.configure({ scope: { slots: "inherit" }, pipeline: [] });
    await (inheriting as any)._scopeBuilding;
    expect(inheriting.slotsInUse()).toEqual({
      store: runtimeSlots,
      inherited: true,
    });

    const owning = new BrowserSubService(
      makeApp(runtimeSlots),
      "board",
      {} as any,
      "unit",
    );
    owning.configure({ scope: { slots: "own" }, pipeline: [] });
    await (owning as any)._scopeBuilding;
    const own = owning.slotsInUse();
    expect(own.inherited).toBe(false);
    expect(own.store).not.toBe(runtimeSlots);
  });
});

describe("changing what leaves a scope", () => {
  it("says it without rebuilding what the scope is running", async () => {
    // Read on the way out of every call, so saying it is all it takes: a
    // scope told to keep its answer to itself should not lose the Timer it
    // was holding in the telling.
    const app = makeApp(createSlotStore());
    const scope = new BrowserSubService(app, "board", {} as any, "read");
    scope.configure({ pipeline: [] });
    await (scope as any)._scopeBuilding;

    const built = (scope as any)._scope;
    expect(scope.state.stopPropagation).toBe(false);

    scope.configure({ stopPropagation: true });

    expect(scope.state.stopPropagation).toBe(true);
    expect((scope as any)._scope).toBe(built);
    expect(app.notify).toHaveBeenCalledWith(scope, { stopPropagation: true });
  });

  it("answers nothing once it does, whatever the pipeline produced", async () => {
    // The half of it a panel is promising: the services after this one stop
    // running from it the moment the choice is made.
    const scope = new BrowserSubService(
      makeApp(createSlotStore()),
      "board",
      {} as any,
      "read",
    );
    scope.configure({ pipeline: [] });
    await (scope as any)._scopeBuilding;

    expect(await scope.process({ carried: true })).toEqual({ carried: true });
    scope.configure({ stopPropagation: true });
    expect(await scope.process({ carried: true })).toBeNull();
  });
});

describe("what a scope hands on", () => {
  it("answers a call by returning, and only by returning", async () => {
    // Pushing the same answer onward as well would run everything after the
    // scope twice — and twice again for every scope nested inside it.
    const app = makeApp(createSlotStore());
    const scope = new BrowserSubService(app, "board", {} as any, "scope");
    scope.configure({
      pipeline: [{ serviceId: "hookup.to/service/monitor", instanceId: "m" }],
    } as any);
    await (scope as any)._scopeBuilding;

    expect(await scope.process({ carried: true })).toEqual({ carried: true });
    expect(app.next).not.toHaveBeenCalled();
  });

  it("pushes onward what a service inside emits on its own", async () => {
    // The other route out, which stays open: a Timer ticking inside a scope
    // has no call to answer, so its result leaves by being pushed.
    const app = makeApp(createSlotStore());
    const scope = new BrowserSubService(app, "board", {} as any, "scope");
    scope.configure({
      pipeline: [{ serviceId: "hookup.to/service/monitor", instanceId: "m" }],
    } as any);
    await (scope as any)._scopeBuilding;

    const inner = scope.getInnerInstance("m")!;
    await (scope as any)._scope.next(inner, { tick: 1 }, null, false);
    expect(app.next).toHaveBeenCalledWith(scope, { tick: 1 });
  });
});

describe("changing which cells a scope holds in", () => {
  it("re-points the store and leaves the built scope alone", async () => {
    // The cheap half of the change is the point: a scope may be holding a
    // Timer, and rebuilding it to answer a question about where a value is
    // kept would restart what it is running — a heavy way to say it.
    const runtimeSlots = createSlotStore();
    const app = makeApp(runtimeSlots);
    const scope = new BrowserSubService(app, "board", {} as any, "reader");
    scope.configure({ scope: { slots: "inherit" }, pipeline: [] });
    await (scope as any)._scopeBuilding;

    const built = (scope as any)._scope;
    expect(built).not.toBeNull();
    expect(scope.slotsInUse().inherited).toBe(true);

    scope.configure({ scope: { slots: "own" } });

    // The same scope object, so everything it holds is still the instance it
    // was — nothing was torn down and built again.
    expect((scope as any)._scope).toBe(built);
    const after = scope.slotsInUse();
    expect(after.inherited).toBe(false);
    expect(after.store).not.toBe(runtimeSlots);
    // Nothing else would tell a panel reading those cells that they changed.
    expect(app.notify).toHaveBeenCalledWith(scope, {
      scope: { slots: "own" },
    });
  });

  it("keeps what a scope of its own was holding across the trip out and back", async () => {
    // Its own cells live on the service rather than on the scope, so a value
    // held before a detour through the runtime's cells is still there after.
    const app = makeApp(createSlotStore());
    const scope = new BrowserSubService(app, "board", {} as any, "unit");
    scope.configure({ scope: { slots: "own" }, pipeline: [] });
    await (scope as any)._scopeBuilding;

    scope.slotsInUse().store?.set("draft", "unsent");
    scope.configure({ scope: { slots: "inherit" } });
    expect(scope.slotsInUse().store?.get("draft")).toBeUndefined();

    scope.configure({ scope: { slots: "own" } });
    expect(scope.slotsInUse().store?.get("draft")).toBe("unsent");
  });
});
