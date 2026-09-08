import { ProcessContext } from "../types";

/**
 * Run identity for a call the browser starts.
 *
 * Every entry point into a board goes through `processRuntime` — the ▶ control,
 * a facade action, a board's play, a service calling another runtime by name —
 * and each of those is a run. Minting here rather than at each of those call
 * sites is what makes a run exist at its origin instead of at the first runtime
 * that happens to need one, which is where a trace would otherwise begin: with
 * the trigger already lost.
 *
 * A context that is already set is a call being continued rather than started —
 * the board hands the previous runtime's context to the next one — so it is
 * passed through untouched.
 */
export function startedRun(
  context?: ProcessContext | null,
): ProcessContext {
  if (context) {
    return context;
  }
  return { requestId: "", runId: crypto.randomUUID() };
}
