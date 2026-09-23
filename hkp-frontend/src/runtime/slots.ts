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
 * `get` and `set` are what hkp-node's `SlotStore` in src/types.ts, hkp-python's
 * in src/hkp/types.py and hkp-rt's in lib/src/runtime_host.h all mirror; the
 * four must agree, because a board naming a slot means the same thing wherever
 * it runs. `entries`, `watch` and `remove` are what it takes to *show* the
 * cells and take one away again, and so belong to the runtime that has a panel
 * rather than to the shared contract — a runtime whose panels are reached over
 * REST would report its cells in a service's state instead.
 */
export interface SlotStore {
  get(name: string): unknown;
  set(name: string, value: unknown): void;
  /** The cells held right now, as a snapshot a panel can draw. */
  entries(): [string, unknown][];
  /**
   * Takes a cell away, name and all.
   *
   * Distinct from writing it empty, which is what a Hold's Clear does: an
   * empty cell is one a board named and nothing has put anything in yet, and
   * it goes on being listed because the board still names it. Removing says
   * there is no such cell here — the next write is what brings the name back.
   */
  remove(name: string): void;
  /**
   * Calls `listener` after every write or removal, and answers with how to
   * stop.
   *
   * A cell is written by whichever pipeline happens to run, which is rarely
   * the one a panel is watching: nothing else would tell a reader of these
   * cells that they had changed.
   */
  watch(listener: () => void): () => void;
}

/** A store of one's own, for a runtime or for a service that scopes its cells. */
export function createSlotStore(): SlotStore {
  const cells = new Map<string, unknown>();
  const watchers = new Set<() => void>();
  const changed = () => {
    for (const listener of watchers) {
      listener();
    }
  };
  return {
    get: (name) => cells.get(name),
    set: (name, value) => {
      cells.set(name, value);
      changed();
    },
    remove: (name) => {
      if (cells.delete(name)) {
        changed();
      }
    },
    entries: () => [...cells.entries()],
    watch: (listener) => {
      watchers.add(listener);
      return () => {
        watchers.delete(listener);
      };
    },
  };
}
