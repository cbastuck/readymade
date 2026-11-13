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
};

/** A turn that ended at its output limit, and the limit it had. */
export type CutOff = Continuation & { limit: number };

export class OutputLimitError extends Error {
  readonly cutOff: CutOff;
  constructor(message: string, cutOff: CutOff) {
    super(message);
    this.name = "OutputLimitError";
    this.cutOff = cutOff;
  }
}

/** Whether a cut-off turn left anything a next request can carry on from. */
export function carriesOn(cut: Continuation) {
  return !!(cut.reasoning?.trim() || cut.partial?.trim());
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
    ...(reasoning ? { reasoning } : {}),
    ...(later.partial ?? earlier.partial
      ? { partial: later.partial ?? earlier.partial }
      : {}),
  };
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
  const now = outputLimit
    ? `${formatTokens(outputLimit)} tokens`
    : "the model's default";
  return `${
    carriesOn(cut)
      ? "Goes on from what the model wrote"
      : "Asks again from the start"
  }, with an output limit of ${now} (this attempt had ${formatTokens(cut.limit)}). Change it in Model settings first.`;
}
