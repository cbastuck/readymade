/**
 * Named cells two pipelines can share a value through.
 *
 * A pipeline pass carries one value and ends; anything that has to survive
 * until a *different* pipeline runs has nowhere to live. A store gives it a
 * name, and whoever owns the pipelines that must share decides which store
 * they see — which is what keeps the sharing scoped to the arrangement that
 * needs it rather than being ambient across a runtime.
 *
 * Deliberately not a cache: nothing expires, nothing is computed on a miss. It
 * is a cell, and the services that read and write it say what it means.
 *
 * Mirrors hkp-node's `SlotStore` in src/types.ts, hkp-python's in
 * src/hkp/types.py and hkp-rt's in lib/src/runtime_host.h; the four must agree,
 * because a board naming a slot means the same thing wherever it runs.
 */
export interface SlotStore {
  get(name: string): unknown;
  set(name: string, value: unknown): void;
}

/** A store of one's own, for a runtime or for a service that scopes its cells. */
export function createSlotStore(): SlotStore {
  const cells = new Map<string, unknown>();
  return {
    get: (name) => cells.get(name),
    set: (name, value) => {
      cells.set(name, value);
    },
  };
}
