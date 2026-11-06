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
  ServiceDescriptor,
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

/**
 * Runs one runtime from the top, handing `params` to its first service — what
 * a runtime's own Run does, where building one means watching what it does.
 * Answers whether the runtime could be asked.
 */
export function runRuntime(
  board: PlayableBoard,
  runtimeId: string,
  params?: unknown,
): boolean {
  const found = resolveRuntime(board, runtimeId);
  if (!found) {
    return false;
  }
  const [scope, api] = found;
  api.processRuntime(scope, params, null);
  return true;
}

/**
 * Runs a runtime's pipeline from one of its services onward, that service
 * included, handing it `params`. The services before it are left alone — what
 * running the runtime cannot do, since that always starts at the top. Answers
 * whether the runtime could be asked.
 */
export function runFrom(
  board: PlayableBoard,
  runtimeId: string,
  service: ServiceDescriptor,
  params?: unknown,
): boolean {
  const found = resolveRuntime(board, runtimeId);
  if (!found) {
    return false;
  }
  const [scope, api] = found;
  Promise.resolve(api.processService(scope, service, params, null)).catch(
    (err) => console.error(`Running ${service.uuid} failed:`, err),
  );
  return true;
}

/** The scope and api of the runtime the board is entered at, where both exist. */
function resolve(board: PlayableBoard) {
  const first = board.runtimes[0];
  return first ? resolveRuntime(board, first.id) : null;
}

function resolveRuntime(board: PlayableBoard, runtimeId: string) {
  const runtime = board.runtimes.find((rt) => rt.id === runtimeId);
  if (!runtime) {
    return null;
  }
  const scope = board.scopes[runtime.id];
  // A runtime names its engine by type, and a board may spell that in the
  // form it was written in rather than the one the apis are filed under.
  const api =
    board.runtimeApis[runtime.type] ||
    board.runtimeApis[toCanonicalRuntimeClassType(runtime.type)];
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
