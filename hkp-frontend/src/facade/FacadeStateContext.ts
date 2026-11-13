import { createContext, useContext } from "react";

import type { BindingSite } from "./bindings";

/**
 * One write to a facade state key: when, what, and who wrote it — the widget,
 * or the init action — where that is known.
 */
export type StateWrite = { at: number; value: unknown; writer?: BindingSite };

export type FacadeStateStore = {
  state: Record<string, unknown>;
  /**
   * Writes a key. `writer` says where the write came from; a widget never
   * passes it itself — the store a widget is handed already knows which widget
   * it is (see LayoutNode).
   */
  setState: (key: string, value: unknown, writer?: BindingSite) => void;
  /**
   * The latest writes per key, newest first, bounded like the flow inspector's
   * history. Held for as long as the facade is on screen, as the state is.
   */
  history?: Record<string, StateWrite[]>;
};

/**
 * `history` with one more write to `key`, newest first, keeping the latest
 * `limit` per key.
 */
export function recordWrite(
  history: Record<string, StateWrite[]>,
  key: string,
  write: StateWrite,
  limit: number,
): Record<string, StateWrite[]> {
  return { ...history, [key]: [write, ...(history[key] ?? [])].slice(0, limit) };
}

export const FacadeStateContext = createContext<FacadeStateStore>({
  state: {},
  setState: () => {},
});

export const useFacadeState = () => useContext(FacadeStateContext);
