import { describe, expect, it } from "vitest";

import { isCancellation } from "../AppContext";

/**
 * A cancelled operation reaching the page unhandled is not an error to show.
 * Monaco's are the case in point: in Safari every keystroke cancels the
 * clipboard write the previous one started.
 */
describe("isCancellation", () => {
  it("recognises Monaco's cancellation", () => {
    // Monaco's CancellationError: name and message both "Canceled".
    const canceled = new Error("Canceled");
    canceled.name = "Canceled";
    expect(isCancellation(canceled)).toBe(true);
  });

  it("leaves every other rejection to be shown", () => {
    expect(isCancellation(new Error("Canceled"))).toBe(false);
    expect(isCancellation(new DOMException("denied", "NotAllowedError"))).toBe(false);
    expect(isCancellation("Canceled")).toBe(false);
    expect(isCancellation(undefined)).toBe(false);
    expect(isCancellation(null)).toBe(false);
  });
});
