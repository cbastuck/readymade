import { expect, it } from "vitest";
import { contextBudget, outputTokens, tooLargeForContext } from "./outputLimit";

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
