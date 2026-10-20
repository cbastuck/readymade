import { describe, expect, it } from "vitest";

import {
  addUsage,
  describeUsage,
  formatPrice,
  fromAnthropicUsage,
  fromOpenAIUsage,
  noUsage,
  priceOf,
  tokenTotal,
} from "./usage";

describe("assistant usage", () => {
  it("reads a Messages API usage, caches included", () => {
    expect(
      fromAnthropicUsage({
        input_tokens: 100,
        output_tokens: 20,
        cache_creation_input_tokens: 30,
        cache_read_input_tokens: 40,
      }),
    ).toEqual({
      requests: 1,
      inputTokens: 100,
      outputTokens: 20,
      cacheWriteTokens: 30,
      cacheReadTokens: 40,
    });
  });

  it("counts a request with no usage as a request, with no tokens", () => {
    expect(fromAnthropicUsage(undefined)).toEqual({ ...noUsage, requests: 1 });
    expect(fromOpenAIUsage(undefined)).toEqual({ ...noUsage, requests: 1 });
  });

  it("separates what an OpenAI-compatible server served from cache", () => {
    expect(
      fromOpenAIUsage({
        prompt_tokens: 1000,
        completion_tokens: 50,
        prompt_tokens_details: { cached_tokens: 600 },
      }),
    ).toMatchObject({ inputTokens: 400, cacheReadTokens: 600, outputTokens: 50 });
  });

  it("prices every kind of token at its own rate", () => {
    const usage = {
      requests: 3,
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheWriteTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
    };
    // $4 input, $20 output, $5 for a cache write (1.25x), $0.20 cache read.
    expect(priceOf("claude-opus-5-5", usage)).toBeCloseTo(29.2);
    expect(tokenTotal(usage)).toBe(4_000_000);
  });

  it("gives no price for a model it has no price for", () => {
    expect(priceOf("llama-local", { ...noUsage, inputTokens: 5 })).toBeUndefined();
    expect(describeUsage({ ...noUsage, requests: 1, inputTokens: 5 }, "llama-local"))
      .toBe("5 tokens · 5 read · 0 written · 1 request");
  });

  it("describes a turn in one line", () => {
    const usage = addUsage(
      fromAnthropicUsage({ input_tokens: 21_000, output_tokens: 940 }),
      fromAnthropicUsage({ input_tokens: 9_000, output_tokens: 60 }),
    );
    expect(describeUsage(usage, "claude-opus-5-5")).toBe(
      "31,000 tokens · 30,000 read · 1,000 written · 2 requests · ≈ $0.14",
    );
  });

  it("does not round a small conversation down to nothing", () => {
    expect(formatPrice(0.004)).toBe("< $0.01");
    expect(formatPrice(0)).toBe("$0.00");
  });
});
