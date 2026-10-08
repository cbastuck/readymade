import { Caller, ProcessContext, RunActor, User } from "../types";

export const DEFAULT_PERSON_RUN_TTL_MS = 15 * 60 * 1000;

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
  return {
    requestId: "",
    runId: crypto.randomUUID(),
    actor: { kind: "local" },
  };
}

/**
 * A run begun by this app, with who was signed in captured at its beginning.
 *
 * Captured rather than looked up later: signing out while a service waits must
 * not change who the rest of that same run belongs to. With nobody signed in,
 * authentication is off for this run and its actor says so explicitly.
 */
export function personRun(user: User | null | undefined): ProcessContext {
  const sub = user?.userId;
  return {
    requestId: "",
    runId: crypto.randomUUID(),
    actor: sub
      ? {
          kind: "person",
          sub,
          expiresAt: Date.now() + DEFAULT_PERSON_RUN_TTL_MS,
          ...(user.email?.trim()
            ? { email: user.email.trim().toLowerCase() }
            : {}),
          ...(user.username ? { name: user.username } : {}),
        }
      : { kind: "local" },
  };
}

/** A new run produced by the board itself: a timer or standing subscription. */
export function boardRun(): ProcessContext {
  return {
    requestId: "",
    runId: crypto.randomUUID(),
    actor: { kind: "board" },
  };
}

/**
 * Run identity for a pipeline a service runs inside itself.
 *
 * The inner pass gets an identity of its own rather than borrowing the one
 * around it, so that what happens inside a sub-pipeline stays distinguishable
 * from what happens around it. The actor is handed down exactly as stated. A
 * board, mount or local run does not turn into a run of this app's
 * signed-in person on the way in.
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
    actor: outer.actor,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** A caller as a coordinator states one, or absent for anything malformed. */
function statedCaller(wire: unknown): Caller | undefined {
  if (!isRecord(wire) || typeof wire.sub !== "string" || !wire.sub) {
    return undefined;
  }
  return {
    sub: wire.sub,
    ...(typeof wire.email === "string" && wire.email
      ? { email: wire.email }
      : {}),
    ...(typeof wire.name === "string" && wire.name ? { name: wire.name } : {}),
  };
}

/** An actor as a trusted coordinator states it. */
function statedActor(wire: unknown): RunActor {
  if (!isRecord(wire)) {
    return { kind: "board" };
  }
  if (wire.kind === "person") {
    const caller = statedCaller(wire);
    return caller
      ? {
          kind: "person",
          ...caller,
          expiresAt:
            typeof wire.expiresAt === "number" &&
            Number.isFinite(wire.expiresAt)
              ? wire.expiresAt
              : 0,
        }
      : { kind: "person", sub: "", expiresAt: 0 };
  }
  if (
    wire.kind === "board" ||
    wire.kind === "mount" ||
    wire.kind === "local"
  ) {
    return { kind: wire.kind };
  }
  return { kind: "board" };
}

/**
 * Run identity for a call a board's coordinator hands to this browser.
 *
 * The run is not this app's: it began somewhere else, and the coordinator says
 * which run it is and what is acting in it. Nothing infers a person actor from
 * whoever happens to be signed in to this browser.
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
    actor: statedActor(stated.actor),
  };
}

/** Person authority is deliberately invalid without a finite live deadline. */
export function runExpired(
  context: ProcessContext | null | undefined,
  now = Date.now(),
): boolean {
  return (
    context?.actor.kind === "person" && context.actor.expiresAt <= now
  );
}
