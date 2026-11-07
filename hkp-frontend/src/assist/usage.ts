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

export type AssistUsage = {
  /** Requests made to the model. */
  requests: number;
  /** Input not served from or written to a cache. */
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
};

export const noUsage: AssistUsage = {
  requests: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheWriteTokens: 0,
  cacheReadTokens: 0,
};

export function addUsage(a: AssistUsage, b: AssistUsage): AssistUsage {
  return {
    requests: a.requests + b.requests,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
  };
}

/** Everything the model read, whichever way it was billed. */
export function inputTotal(usage: AssistUsage): number {
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
  return {
    requests: 1,
    inputTokens: count(u.input_tokens),
    outputTokens: count(u.output_tokens),
    cacheWriteTokens: count(u.cache_creation_input_tokens),
    cacheReadTokens: count(u.cache_read_input_tokens),
  };
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
  return {
    requests: 1,
    inputTokens: Math.max(0, count(u.prompt_tokens) - cached),
    outputTokens: count(u.completion_tokens),
    cacheWriteTokens: 0,
    cacheReadTokens: cached,
  };
}

/** US dollars per million tokens. */
type Rates = { input: number; output: number; cacheRead: number };

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
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
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
  return (
    (usage.inputTokens * rates.input +
      usage.cacheWriteTokens * rates.input * CACHE_WRITE_FACTOR +
      usage.cacheReadTokens * rates.cacheRead +
      usage.outputTokens * rates.output) /
    1_000_000
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
