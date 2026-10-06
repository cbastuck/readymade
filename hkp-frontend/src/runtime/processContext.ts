import { Caller, ProcessContext } from "../types";

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

/**
 * Run identity for a pipeline a service runs inside itself.
 *
 * The inner pass gets an identity of its own rather than borrowing the one
 * around it, so that what happens inside a sub-pipeline stays distinguishable
 * from what happens around it. Who began the work is the same person however
 * deep it goes, so the caller is handed down exactly as it was stated —
 * including `null`, a run that arrived naming nobody, which must not turn
 * into a run of this app's own on the way in.
 *
 * `outer` is the run the service holding the pipeline is being called in; a
 * service called in none starts its pipeline in none.
 */
export function nestedRun(
  outer: ProcessContext | null | undefined,
): ProcessContext | null {
  if (!outer) {
    return null;
  }
  return {
    requestId: "",
    runId: crypto.randomUUID(),
    ...(outer.runId ? { parentRunId: outer.runId } : {}),
    ...(outer.caller !== undefined ? { caller: outer.caller } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** A caller as a coordinator states one, or null for anything that is not. */
function statedCaller(wire: unknown): Caller | null {
  if (!isRecord(wire) || typeof wire.sub !== "string" || !wire.sub) {
    return null;
  }
  return {
    sub: wire.sub,
    ...(typeof wire.email === "string" && wire.email
      ? { email: wire.email }
      : {}),
    ...(typeof wire.name === "string" && wire.name ? { name: wire.name } : {}),
  };
}

/**
 * Run identity for a call a board's coordinator hands to this browser.
 *
 * The run is not this app's: it began somewhere else, and the coordinator says
 * which run it is and who began it. Both are kept as stated. `caller` is
 * always set — to `null` when the coordinator named nobody — so that nothing
 * downstream mistakes a run that arrived for one the person at this browser
 * began; see `ProcessContext.caller`.
 *
 * A coordinator that says no run at all still handed one over, so one is
 * minted for it here.
 */
export function continuedRun(
  wire: unknown,
  reply: Pick<ProcessContext, "requestId" | "onResolve">,
): ProcessContext {
  const stated = isRecord(wire) ? wire : {};
  return {
    ...reply,
    runId:
      typeof stated.runId === "string" && stated.runId
        ? stated.runId
        : crypto.randomUUID(),
    ...(typeof stated.parentRunId === "string" && stated.parentRunId
      ? { parentRunId: stated.parentRunId }
      : {}),
    caller: statedCaller(stated.caller),
  };
}
