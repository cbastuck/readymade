import { expect, it } from "vitest";
import {
  contextBudget,
  continueHint,
  continueLabel,
  joinCutOffs,
  outputTokens,
  TOOL_STEPS,
  tooLargeForContext,
} from "./outputLimit";

it("writes what the person set, or the fallback, never more than the model can", () => {
  expect(outputTokens({ outputLimit: 8000, fallback: 16384 })).toBe(8000);
  expect(outputTokens({ outputLimit: 8000, stated: 4096, fallback: 16384 })).toBe(4096);
  expect(outputTokens({ fallback: 16384 })).toBe(16384);
  expect(outputTokens({ stated: 4096, fallback: 16384 })).toBe(4096);
  expect(outputTokens({ stated: null, fallback: 16384 })).toBe(16384);
});

it("gives an answer at most a quarter of the context unless the person sets more", () => {
  const unset = contextBudget({ contextTokens: 32768, defaultOutput: 16384 });
  expect(unset.maxTokens).toBe(8192);
  expect(unset.room).toBe((32768 - 8192 - 512) * 2);
  expect(contextBudget({ contextTokens: 32768, outputLimit: 20000 }).maxTokens).toBe(20000);
});

it("blames the output limit only when the person set one", () => {
  const limited = contextBudget({ contextTokens: 8192, outputLimit: 7000 });
  expect(tooLargeForContext(limited, "Too large.").message).toMatch(
    /output limit \(7,000 tokens\) leaves too little of the 8,192-token context/,
  );
  expect(tooLargeForContext(contextBudget({}), "Too large.").message).toBe("Too large.");
});

it("keeps an earlier transcript when a later attempt by another model left none", () => {
  const first = { via: "chat" as const, model: "a", messages: ["read"], text: "", basis: "board" };
  const second = { via: "chat" as const, model: "b", messages: ["other"], text: "" };
  expect(joinCutOffs({ transcript: first }, { limit: 4096 }).transcript).toBe(first);
  expect(
    joinCutOffs({ transcript: first }, { limit: 4096, transcript: second }).transcript,
  ).toBe(second);
});

it("names what a Continue or Retry went on with", () => {
  const transcript = { via: "chat" as const, model: "a", messages: [], text: "" };
  const same = { via: "chat" as const, model: "a" };
  const other = { via: "chat" as const, model: "b" };
  expect(continueLabel({ limit: 4096, transcript }, 40000, same)).toBe(
    "Continue with an output limit of 40,000 tokens",
  );
  expect(continueLabel({ limit: 4096, transcript }, 0, other)).toBe(
    "Retry with the model's default output limit",
  );
  expect(continueLabel({ limit: 4096, lookups: true, transcript }, 0, same)).toBe(
    `Continue for up to ${TOOL_STEPS} more requests`,
  );
  expect(continueLabel({ limit: 4096, lookups: true }, 0, same)).toBe(
    `Retry for up to ${TOOL_STEPS} requests`,
  );
  expect(continueHint({ limit: 4096, transcript }, 0, same)).toMatch(
    /If the board or the editing scope has changed since, it asks again from the start instead\./,
  );
  expect(continueHint({ limit: 4096, transcript }, 0, other)).not.toMatch(/has changed since/);
});
