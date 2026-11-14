/**
 * What a conversation with the assistant cost: every request it took, not
 * only the one that proposed a board.
 *
 * A turn is several requests — the model searches and reads documentation,
 * each read goes back to it as input, and only then does it propose — so a
 * figure taken from the last response alone would leave out most of the
 * input. Usage is summed over every request a turn made, and turns over the
 * conversation, and that sum is what a price is put on.
 */

type TokenCounts = {
  /** Input not served from or written to a cache. */
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
};

export type AssistUsage = TokenCounts & {
  /** Requests made to the model. */
  requests: number;
  /**
   * The part of the counts above made by requests whose prompt was longer
   * than `LONG_PROMPT_TOKENS`, which some models bill on a rate card of its
   * own. Kept apart because the card is chosen per request, and a sum over
   * requests no longer says which of them were long. Absent when none was.
   */
  longPrompt?: TokenCounts;
};

/** A prompt longer than this is billed on a model's long-prompt rates. */
export const LONG_PROMPT_TOKENS = 100_000;

const noTokens: TokenCounts = {
  inputTokens: 0,
  outputTokens: 0,
  cacheWriteTokens: 0,
  cacheReadTokens: 0,
};

function addTokens(a: TokenCounts, b: TokenCounts): TokenCounts {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
  };
}

/** One request's usage, marked as long when its prompt was. */
function oneRequest(tokens: TokenCounts): AssistUsage {
  const usage: AssistUsage = { requests: 1, ...tokens };
  return inputTotal(usage) > LONG_PROMPT_TOKENS
    ? { ...usage, longPrompt: { ...tokens } }
    : usage;
}

export const noUsage: AssistUsage = {
  requests: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheWriteTokens: 0,
  cacheReadTokens: 0,
};

export function addUsage(a: AssistUsage, b: AssistUsage): AssistUsage {
  const sum: AssistUsage = { requests: a.requests + b.requests, ...addTokens(a, b) };
  return a.longPrompt || b.longPrompt
    ? {
        ...sum,
        longPrompt: addTokens(a.longPrompt ?? noTokens, b.longPrompt ?? noTokens),
      }
    : sum;
}

/** Everything the model read, whichever way it was billed. */
export function inputTotal(usage: TokenCounts): number {
  return usage.inputTokens + usage.cacheWriteTokens + usage.cacheReadTokens;
}

export function tokenTotal(usage: AssistUsage): number {
  return inputTotal(usage) + usage.outputTokens;
}

const count = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;

/** One Messages API response's `usage`. */
export function fromAnthropicUsage(usage: unknown): AssistUsage {
  const u = (usage ?? {}) as Record<string, unknown>;
  return oneRequest({
    inputTokens: count(u.input_tokens),
    outputTokens: count(u.output_tokens),
    cacheWriteTokens: count(u.cache_creation_input_tokens),
    cacheReadTokens: count(u.cache_read_input_tokens),
  });
}

/**
 * One OpenAI-compatible response's `usage`, when the server sent one — many
 * local servers do not, and then the request is counted with no tokens rather
 * than with a guess.
 */
export function fromOpenAIUsage(usage: unknown): AssistUsage {
  const u = (usage ?? {}) as Record<string, unknown>;
  const details = (u.prompt_tokens_details ?? {}) as Record<string, unknown>;
  const cached = count(details.cached_tokens);
  return oneRequest({
    inputTokens: Math.max(0, count(u.prompt_tokens) - cached),
    outputTokens: count(u.completion_tokens),
    cacheWriteTokens: 0,
    cacheReadTokens: cached,
  });
}

/**
 * One Responses API response's `usage`: the same counts as chat completions,
 * under the names that API gives them. Reasoning is part of the output.
 */
export function fromOpenAIResponsesUsage(usage: unknown): AssistUsage {
  const u = (usage ?? {}) as Record<string, unknown>;
  const details = (u.input_tokens_details ?? {}) as Record<string, unknown>;
  const cached = count(details.cached_tokens);
  return oneRequest({
    inputTokens: Math.max(0, count(u.input_tokens) - cached),
    outputTokens: count(u.output_tokens),
    cacheWriteTokens: 0,
    cacheReadTokens: cached,
  });
}

/** US dollars per million tokens. */
type Card = { input: number; output: number; cacheRead: number };
/** A model's rates; `longPrompt` for a request whose prompt is longer than
 *  `LONG_PROMPT_TOKENS`, where the model has a card for those. */
type Rates = Card & { longPrompt?: Card };

/**
 * Anthropic's first-party API list prices, as of the date below. A price
 * shown from this table says so, because it ages: a model missing here is
 * shown in tokens alone rather than at a price somebody guessed.
 */
export const PRICES_AS_OF = "2026-10-06";
const RATES: Record<string, Rates> = {
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.25 },
  "claude-fable-5": { input: 10, output: 50, cacheRead: 1 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-7": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-6": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3 },
  "claude-haiku-5-5": {
    input: 0.1,
    output: 0.5,
    cacheRead: 0.01,
    longPrompt: { input: 0.5, output: 2.5, cacheRead: 0.05 },
  },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1 },
};
/** A five-minute cache write costs a quarter more than plain input. */
const CACHE_WRITE_FACTOR = 1.25;

/**
 * What the usage cost in US dollars on the Anthropic API, or `undefined` for
 * a model the table does not know — including every model behind an
 * OpenAI-compatible server, which is the person's own to price.
 */
export function priceOf(modelId: string, usage: AssistUsage): number | undefined {
  const rates = RATES[modelId];
  if (!rates) return undefined;
  const long = usage.longPrompt ?? noTokens;
  const total = rates.longPrompt
    ? cost(usage, rates) - cost(long, rates) + cost(long, rates.longPrompt)
    : cost(usage, rates);
  return total / 1_000_000;
}

/** Tokens at one card's rates, in US dollars times a million. */
function cost(tokens: TokenCounts, card: Card): number {
  return (
    tokens.inputTokens * card.input +
    tokens.cacheWriteTokens * card.input * CACHE_WRITE_FACTOR +
    tokens.cacheReadTokens * card.cacheRead +
    tokens.outputTokens * card.output
  );
}

const whole = new Intl.NumberFormat("en-US");

export function formatTokens(tokens: number): string {
  return whole.format(Math.round(tokens));
}

/** Cents below a dollar, so a small conversation does not read as $0.00. */
export function formatPrice(dollars: number): string {
  if (dollars > 0 && dollars < 0.01) return "< $0.01";
  return `$${dollars.toFixed(2)}`;
}

/**
 * One line for a turn or a conversation: the tokens read and written, how
 * many requests that took, and the price when there is one to give.
 */
export function describeUsage(usage: AssistUsage, modelId: string): string {
  const parts = [
    `${formatTokens(tokenTotal(usage))} tokens`,
    `${formatTokens(inputTotal(usage))} read`,
    `${formatTokens(usage.outputTokens)} written`,
    `${usage.requests} request${usage.requests === 1 ? "" : "s"}`,
  ];
  const price = priceOf(modelId, usage);
  if (price !== undefined) parts.push(`≈ ${formatPrice(price)}`);
  return parts.join(" · ");
}
