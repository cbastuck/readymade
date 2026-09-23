/**
 * Running the board from a control that means the whole board.
 *
 * A runtime's own header runs that runtime, which is what building one needs.
 * This is the other thing: starting the board where a board starts, from
 * wherever it is being looked at — the toolbar over it, the overview above
 * that. A board driven by something that has not happened yet — a request
 * arriving, a timer nobody started — is otherwise looked at doing nothing.
 *
 * What runs is the board from the top: the first runtime's first service, with
 * whatever is handed over as its input, which is the same thing pressing play
 * on that runtime does. Nothing handed over means nothing on the input, and
 * that is not the same as an empty object — a service that answers an empty
 * input with its own configuration would send `{}` and call it the payload.
 */
import { ReactNode, createContext, useContext, useMemo, useState } from "react";

import {
  RuntimeApiMap,
  RuntimeDescriptor,
  RuntimeScope,
  toCanonicalRuntimeClassType,
} from "hkp-frontend/src/types";

export type PlayableBoard = {
  runtimes: Array<RuntimeDescriptor>;
  scopes: { [runtimeId: string]: RuntimeScope };
  runtimeApis: RuntimeApiMap;
};

/**
 * Whether there is a runtime to start the board at, and one that can be asked.
 *
 * A board with nothing in it has nothing to run; so has one whose first
 * runtime has not finished being restored, which is a moment rather than a
 * state, and reads the same from here.
 */
export function canPlay(board: PlayableBoard): boolean {
  return resolve(board) !== null;
}

/**
 * Starts the board, handing `params` to the first service of the first
 * runtime. Answers whether there was anything to start.
 */
export function play(board: PlayableBoard, params?: unknown): boolean {
  const found = resolve(board);
  if (!found) {
    return false;
  }
  const [scope, api] = found;
  api.processRuntime(scope, params, null);
  return true;
}

/** The scope and api of the runtime the board is entered at, where both exist. */
function resolve(board: PlayableBoard) {
  const first = board.runtimes[0];
  if (!first) {
    return null;
  }
  const scope = board.scopes[first.id];
  // A runtime names its engine by type, and a board may spell that in the
  // form it was written in rather than the one the apis are filed under.
  const api =
    board.runtimeApis[first.type] ||
    board.runtimeApis[toCanonicalRuntimeClassType(first.type)];
  return scope && api ? ([scope, api] as const) : null;
}

/**
 * What the board was last run with, shared by the controls that can run it.
 *
 * Writing an input is the effort; sending it again is a press. Which press —
 * the toolbar's or the overview's — should not decide whether the board
 * remembers, so what was written is kept where both can reach it rather than
 * beside either of them.
 */
type RunParams = [unknown, (params: unknown) => void];

const RunParamsCtx = createContext<RunParams | null>(null);

export function PlayProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useState<unknown>(undefined);
  const value = useMemo<RunParams>(() => [params, setParams], [params]);
  return (
    <RunParamsCtx.Provider value={value}>{children}</RunParamsCtx.Provider>
  );
}

/**
 * The last input, and how to replace it. A control mounted outside a provider
 * keeps its own rather than refusing to work: there is nothing to share with.
 */
export function useRunParams(): RunParams {
  const shared = useContext(RunParamsCtx);
  const own = useState<unknown>(undefined);
  return shared ?? own;
}
