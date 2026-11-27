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
  /**
   * Characters of the context the turn had taken by then — the request, the
   * board and what it read — where the turn counts them. A resumed turn
   * counts what is left against its own budget, which a raised output limit
   * makes smaller.
   */
  used?: number;
  /**
   * The input of the turn's last request as the provider counted it: about
   * what every further request sends again.
   */
  inputTokens?: number;
  /**
   * The board and editing scope its requests were about, as the panel saw
   * them when the attempt began (`useBoardAssist.ts`). The first request
   * carries that board, so a transcript is resumed only while the board is
   * still the same; one changed since is asked about again from the start.
   */
  basis?: string;
};

/**
 * What would go on from a cut-off turn now: a tool turn over `via` with
 * `model`, or a one-shot turn (`"text"`) that carries what the model wrote.
 */
export type Resumer = {
  via: ToolTranscript["via"] | "text";
  model: string;
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

/** Whether a cut-off turn left text a one-shot turn can carry on from. */
export function carriesWritten(cut: Continuation) {
  return !!(cut.reasoning?.trim() || cut.partial?.trim());
}

/**
 * Whether what would run now can go on from a cut-off turn, rather than ask
 * again from the start: a tool turn only from its own model's transcript over
 * the same API, a one-shot turn from what the model wrote.
 */
export function carriesOn(cut: Continuation, by: Resumer) {
  return by.via === "text"
    ? carriesWritten(cut)
    : !!resumedTranscript(cut, by.via, by.model);
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
    // A later attempt that went on from the earlier has all of it in its own
    // transcript. One by another model that was cut off at its first request
    // has none, and the earlier one stays for when that model is selected
    // again.
    ...(later.transcript ?? earlier.transcript
      ? { transcript: later.transcript ?? earlier.transcript }
      : {}),
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

/**
 * Why a cut-off tool turn cannot be gone on from now, when it could have been
 * by the model or API that ran it.
 */
function elsewhere(cut: CutOff, by: Resumer) {
  const transcript = cut.transcript;
  if (!transcript || carriesOn(cut, by)) return "";
  return transcript.model !== by.model
    ? ` What it had read was with ${transcript.model}; select that model again to go on from there.`
    : " What it had read was with another provider; select it again to go on from there.";
}

/** What going on from a tool turn's transcript costs, as far as it is known. */
function resendCost(cut: CutOff, by: Resumer) {
  const tokens = cut.transcript?.inputTokens;
  return tokens && carriesOn(cut, by)
    ? ` Every further request sends all of it again, about ${formatTokens(tokens)} tokens of input each, and is billed for it.`
    : "";
}

/**
 * What going on from a tool turn's transcript depends on: the board it read
 * is in the transcript, and is checked against the board when Continue is
 * pressed.
 */
function unlessChanged(cut: CutOff, by: Resumer) {
  return cut.transcript && by.via !== "text"
    ? " If the board or the editing scope has changed since, it asks again from the start instead."
    : "";
}

/** What Continue (or Retry) beside a cut-off turn will ask for. */
export function continueHint(cut: CutOff, outputLimit: number, by: Resumer) {
  const going = carriesOn(cut, by);
  if (cut.lookups)
    return going
      ? `Goes on from where the model stopped, with the documentation it read, for up to ${TOOL_STEPS} more requests.${resendCost(cut, by)}${unlessChanged(cut, by)}`
      : `Asks again from the start, for up to ${TOOL_STEPS} requests.${elsewhere(cut, by)}`;
  const now = outputLimit
    ? `${formatTokens(outputLimit)} tokens`
    : "the model's default";
  const from =
    by.via === "text" ? "what the model wrote" : "the documentation it read";
  return `${
    going ? `Goes on from ${from}` : "Asks again from the start"
  }, with an output limit of ${now} (this attempt had ${formatTokens(cut.limit)}). Change it in Model settings first; a higher limit lets the model write, and bill, more.${going ? `${resendCost(cut, by)}${unlessChanged(cut, by)}` : elsewhere(cut, by)}`;
}

/**
 * How a Continue (or Retry) is shown in the conversation: what it went on
 * with. `outputLimit` is the limit it was sent with, 0 for the model's own.
 */
export function continueLabel(cut: CutOff, outputLimit: number, by: Resumer) {
  const going = carriesOn(cut, by);
  const verb = going ? "Continue" : "Retry";
  return cut.lookups
    ? `${verb} for up to ${TOOL_STEPS} ${going ? "more " : ""}requests`
    : `${verb} with ${outputLimit ? `an output limit of ${formatTokens(outputLimit)} tokens` : "the model's default output limit"}`;
}
