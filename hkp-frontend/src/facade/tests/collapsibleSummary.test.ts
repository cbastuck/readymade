import { describe, expect, it } from "vitest";

import { summaryText } from "../panels/CollapsibleSection";

/**
 * What a folded section says about what is behind it.
 *
 * The point of the number is that folding stays safe: a header set two
 * requests ago and then hidden is a header you will not remember, so a closed
 * section has to keep reporting. Which means a count for anything with parts,
 * and never an empty string where there is something to report.
 */
describe("a folded section's summary", () => {
  it("counts the parts of an object", () => {
    expect(summaryText({ accept: "application/json" })).toBe("1");
    expect(summaryText({})).toBe("0");
  });

  it("counts the entries of an array", () => {
    expect(summaryText([1, 2, 3])).toBe("3");
  });

  it("says nothing when the service has not reported yet", () => {
    expect(summaryText(undefined)).toBe("");
    expect(summaryText(null)).toBe("");
  });

  it("shows anything else as it reads", () => {
    expect(summaryText("get")).toBe("get");
    expect(summaryText(0)).toBe("0");
  });
});
