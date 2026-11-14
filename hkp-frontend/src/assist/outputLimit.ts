import { formatTokens } from "./usage";

/**
 * What a model had written when a turn reached its output limit — kept, so
 * that the next request can carry on from it instead of starting over.
 */
export type Continuation = {
  /** The model's reasoning, when the provider sends it. */
  reasoning?: string;
  /** The answer as far as it got. */
  partial?: string;
  /** Where a tool turn had got to, to resume from rather than ask again. */
  transcript?: ToolTranscript;
};

/**
 * A tool turn's requests and what answered them, up to the last one that
 * completed — the documentation it read and, where the provider hands it
 * out, the model's reasoning — in the shape of the API that carried it. Kept
 * in memory beside the failed turn only, and resumed only by the same model
 * over the same API: a provider's reasoning is not readable by another.
 */
export type ToolTranscript = {
  via: "anthropic" | "chat" | "responses";
  model: string;
  messages: unknown[];
  /** What the model had said so far. */
  text: string;
  /** Characters of context left for documentation, where the turn counts them. */
  room?: number;
};

/**
 * A turn that ended at its output limit, and the limit it had — or, with
 * `lookups`, one that used every request a turn may make.
 */
export type CutOff = Continuation & { limit: number; lookups?: boolean };

export class OutputLimitError extends Error {
  readonly cutOff: CutOff;
  constructor(message: string, cutOff: CutOff) {
    super(message);
    this.name = "OutputLimitError";
    this.cutOff = cutOff;
  }
}

/** How many requests one tool turn may make, a resumed one as many again. */
export const TOOL_STEPS = 12;

/** A tool turn that made all its requests without proposing or answering. */
export class LookupLimitError extends Error {
  readonly cutOff: CutOff;
  constructor(cutOff: Omit<CutOff, "lookups">) {
    super(
      "The assistant reached its documentation lookup limit. Continue to let it go on from where it stopped, or narrow the request.",
    );
    this.name = "LookupLimitError";
    this.cutOff = { ...cutOff, lookups: true };
  }
}

/** What a failed turn left to go on from, when it was cut off at a limit. */
export function cutOffOf(error: unknown): CutOff | undefined {
  return error instanceof OutputLimitError || error instanceof LookupLimitError
    ? error.cutOff
    : undefined;
}

/**
 * The transcript a tool turn resumes, when the continuation holds one this
 * model and API can read.
 */
export function resumedTranscript(
  continuation: Continuation | undefined,
  via: ToolTranscript["via"],
  model: string,
) {
  const transcript = continuation?.transcript;
  return transcript?.via === via && transcript.model === model
    ? transcript
    : undefined;
}

/** Whether a cut-off turn left anything a next request can carry on from. */
export function carriesOn(cut: Continuation) {
  return !!(cut.reasoning?.trim() || cut.partial?.trim() || cut.transcript);
}

/**
 * Two cut-off attempts at the same request as one: the reasoning of both, in
 * order, since the second went on from the first, and the latest answer.
 */
export function joinCutOffs(earlier: Continuation | undefined, later: CutOff): CutOff {
  if (!earlier) return later;
  const reasoning = [earlier.reasoning, later.reasoning]
    .filter((text) => text?.trim())
    .join("\n\n");
  return {
    limit: later.limit,
    ...(later.lookups ? { lookups: true } : {}),
    // The later attempt went on from the earlier, so its transcript has all.
    ...(later.transcript ? { transcript: later.transcript } : {}),
    ...(reasoning ? { reasoning } : {}),
    ...(later.partial ?? earlier.partial
      ? { partial: later.partial ?? earlier.partial }
      : {}),
  };
}

/**
 * What a turn may write, in tokens: the output limit the person set, or
 * `fallback` without one — never more than the model states it can write.
 */
export function outputTokens(options: {
  outputLimit?: number;
  /** What the model states it can write, where it states it. */
  stated?: number | null;
  fallback: number;
}): number {
  const tokens = options.outputLimit || options.fallback;
  return Math.min(tokens, options.stated || tokens);
}

/**
 * How a turn to a model of a given context divides it: what the answer may
 * write (`outputTokens`, by default at most a quarter of the context), and
 * the room left for the request, in characters — counted at two a token so
 * that dense JSON fits too, with 512 tokens kept for the framing.
 */
export type ContextBudget = {
  contextTokens: number;
  maxTokens: number;
  room: number;
  /** Whether `maxTokens` is the person's output limit. */
  limited: boolean;
};

export function contextBudget(options: {
  contextTokens?: number;
  outputLimit?: number;
  stated?: number | null;
  /** What a turn writes by default, before the quarter-of-context cap. */
  defaultOutput?: number;
}): ContextBudget {
  const contextTokens = Math.max(4096, options.contextTokens || 8192);
  const maxTokens = outputTokens({
    outputLimit: options.outputLimit,
    stated: options.stated,
    fallback: Math.min(options.defaultOutput || 4096, Math.floor(contextTokens / 4)),
  });
  return {
    contextTokens,
    maxTokens,
    room: (contextTokens - maxTokens - 512) * 2,
    limited: !!options.outputLimit,
  };
}

/**
 * Why a request does not fit its budget: the person's output limit, when
 * they set one, or `otherwise` — what the provider's context is called.
 */
export function tooLargeForContext(budget: ContextBudget, otherwise: string) {
  return new Error(
    budget.limited
      ? `The output limit (${formatTokens(budget.maxTokens)} tokens) leaves too little of the ${formatTokens(budget.contextTokens)}-token context for this board. Lower it in Model settings, or edit a smaller board.`
      : otherwise,
  );
}

export const MIN_OUTPUT_LIMIT = 1024;
const MAX_OUTPUT_LIMIT = 1_000_000;

/** A typed output limit as the setting keeps it: 0 when left empty. */
export function parseOutputLimit(draft: string): number {
  const value = draft.trim().replace(/[,_\s]/g, "");
  if (!value) return 0;
  const tokens = Number(value);
  if (
    !Number.isInteger(tokens) ||
    tokens < MIN_OUTPUT_LIMIT ||
    tokens > MAX_OUTPUT_LIMIT
  )
    throw new Error(
      `Set between ${formatTokens(MIN_OUTPUT_LIMIT)} and ${formatTokens(MAX_OUTPUT_LIMIT)} tokens, or leave it empty for the model default.`,
    );
  return tokens;
}

/** What Continue (or Retry) beside a cut-off turn will ask for. */
export function continueHint(cut: CutOff, outputLimit: number) {
  if (cut.lookups)
    return cut.transcript
      ? `Goes on from where the model stopped, with the documentation it read, for up to ${TOOL_STEPS} more requests.`
      : `Asks again from the start, for up to ${TOOL_STEPS} requests.`;
  const now = outputLimit
    ? `${formatTokens(outputLimit)} tokens`
    : "the model's default";
  return `${
    carriesOn(cut)
      ? "Goes on from what the model wrote"
      : "Asks again from the start"
  }, with an output limit of ${now} (this attempt had ${formatTokens(cut.limit)}). Change it in Model settings first.`;
}
