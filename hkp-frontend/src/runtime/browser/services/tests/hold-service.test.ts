import { describe, expect, it, vi } from "vitest";

import HoldDescriptor from "../Hold";
import { createSlotStore, SlotStore } from "../../../slots";

/**
 * Hold in the browser runtime, in both of its arrangements.
 *
 * A pipeline pass carries one value and ends, so a producer running on its own
 * schedule and a consumer arriving whenever it arrives have nowhere to meet.
 * Hold is that cell — and which of the two is calling can be said by the
 * **value** (a property only the producer carries) or by the **board** (a slot
 * two Holds name, each declaring its end).
 *
 * Ported from hkp-node's tests/hold.test.ts. The same board says the same thing
 * here, which is the whole point of the service existing in both.
 */

function makeHold(state: Record<string, unknown>, slots?: SlotStore) {
  const notify = vi.fn();
  const app = {
    notify,
    next: vi.fn(),
    sendAction: vi.fn(),
    slots: slots ? () => slots : undefined,
  } as any;
  const service = HoldDescriptor.create(app, "board", {} as any, "hold-1") as any;
  service.configure(state);
  return { service, notify };
}

describe("a Hold told which end it is", () => {
  it("lets two pipelines that never meet share a value", () => {
    // The arrangement an endpoint uses: one pass writes the document, a
    // request arriving later reads it back.
    const slots = createSlotStore();
    const { service: writer } = makeHold({ slot: "document", op: "write" }, slots);
    const { service: reader } = makeHold({ slot: "document", op: "read" }, slots);

    // A write emits its input unchanged, so the pass it belongs to carries on
    // as though the Hold were not there.
    expect(writer.process({ body: "a feed" })).toEqual({ body: "a feed" });
    expect(reader.process(undefined)).toEqual({ body: "a feed" });
  });

  it("stops while nothing is held", () => {
    // A consumer that arrives before the producer has run: null is nothing to
    // pass on, the same as everywhere else.
    const slots = createSlotStore();
    const { service: reader } = makeHold({ slot: "document", op: "read" }, slots);
    expect(reader.process(undefined)).toBeNull();
  });

  it("holds what a property never could", () => {
    // Nothing inspects the value, which is what lets a slot carry bytes.
    const slots = createSlotStore();
    const { service: writer } = makeHold({ slot: "raw", op: "write" }, slots);
    const { service: reader } = makeHold({ slot: "raw", op: "read" }, slots);

    const bytes = new Uint8Array([1, 2, 3]);
    writer.process(bytes);
    expect(reader.process(undefined)).toBe(bytes);
  });

  it("keeps what it holds to the store it was given", () => {
    // Two scopes, two stores, one slot name: the name is scoped to the
    // arrangement that needs it rather than being ambient.
    const left = createSlotStore();
    const right = createSlotStore();
    const { service: writer } = makeHold({ slot: "shared", op: "write" }, left);
    const { service: reader } = makeHold({ slot: "shared", op: "read" }, right);

    writer.process({ value: 7 });
    expect(reader.process(undefined)).toBeNull();
  });

  it("reports what is held without sending what cannot be written down", () => {
    const slots = createSlotStore();
    const { service: writer, notify } = makeHold(
      { slot: "raw", op: "write" },
      slots,
    );
    writer.process(new Uint8Array([1, 2, 3, 4]));

    const said = notify.mock.calls.at(-1)?.[1];
    expect(said.held).toBe("[4 bytes]");
    expect(said.writeCount).toBe(1);
    // Only the arrangement in use: a property field here would be one a reader
    // has to discount.
    expect(said.property).toBeUndefined();
    expect(said.slot).toBe("raw");
  });
});

describe("a Hold that tells the sides apart by the value", () => {
  it("replaces what is held when the input carries the property", () => {
    const { service } = makeHold({ property: "triggerCount" });

    // The producer: carrying the property makes the call a write.
    expect(service.process({ triggerCount: 7 })).toEqual({ triggerCount: 7 });
    // The consumer: anything else is a read, answered with what is held.
    expect(service.process({ other: 1 })).toEqual({ triggerCount: 7 });
  });

  it("is a wire until something is named", () => {
    // An unconfigured Hold passes its input on rather than swallowing it,
    // so a half-built board stays legible.
    const { service } = makeHold({});
    expect(service.process({ anything: true })).toEqual({ anything: true });
  });

  it("forgets what it held when the property is renamed", () => {
    // What is held belongs to the property it was written for.
    const { service } = makeHold({ property: "a" });
    service.process({ a: 1 });
    service.configure({ property: "b" });
    expect(service.process({ other: 1 })).toBeNull();
  });

  it("clears on request, counts included", () => {
    // The counts say how often each side has called for what is held *now*.
    const { service, notify } = makeHold({ property: "a" });
    service.process({ a: 1 });
    service.configure({ action: "clear" });

    const said = notify.mock.calls.at(-1)?.[1];
    expect(said.held).toBeNull();
    expect(said.writeCount).toBe(0);
    expect(said.readCount).toBe(0);
  });
});

describe("a Hold in a runtime that provides no cells", () => {
  it("still holds, for itself alone", () => {
    // Rather than dropping what it was given: a slot with nowhere to share
    // through is a private cell, not an error.
    const { service } = makeHold({ slot: "document", op: "write" });
    expect(service.process({ body: "a feed" })).toEqual({ body: "a feed" });

    const { service: sameService } = makeHold({ slot: "document", op: "read" });
    // A different instance, so a different private cell — which is exactly why
    // a shared store is what makes two ends meet.
    expect(sameService.process(undefined)).toBeNull();
  });
});
