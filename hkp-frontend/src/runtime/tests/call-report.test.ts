import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  CALL_REPORT_LIMIT,
  PREVIEW_LENGTH,
  isTooLarge,
  reportedValue,
} from "../callReport";
import { onServiceProcess, onServiceResult } from "../serviceState";

/**
 * A call report carries the value only up to a limit; above it, a description.
 * The same cases as hkp-node's call-report.test.ts, hkp-python's
 * test_call_report.py and hkp-rt's call_report.test.cpp.
 */

const LIMIT = 100;

describe("a value small enough", () => {
  it("is reported as it is", () => {
    const value = { a: [1, "two", null, true] };
    expect(reportedValue(value, LIMIT)).toBe(value);
    expect(reportedValue("short", LIMIT)).toBe("short");
    expect(reportedValue(42, LIMIT)).toBe(42);
    expect(reportedValue(null, LIMIT)).toBeNull();
    expect(reportedValue(undefined, LIMIT)).toBeUndefined();
  });

  it("is anything that is not data, which is not looked inside", () => {
    // An instance may reach a whole graph, in a cycle; none of it is a value.
    class Holder {
      self = this;
      big = "x".repeat(LIMIT * 10);
    }
    const holder = new Holder();
    expect(reportedValue(holder, LIMIT)).toBe(holder);
    expect(isTooLarge(reportedValue({ holder }, LIMIT))).toBe(false);
  });
});

describe("a value too large", () => {
  it("is a text described by its size in bytes and how it begins", () => {
    const text = "é".repeat(60); // 120 bytes in 60 characters
    expect(reportedValue(text, LIMIT)).toEqual({
      __hkpTooLarge: { type: "string", bytes: 120, exact: true, preview: text },
    });
  });

  it("is a text longer than the limit in characters, not counted further", () => {
    expect(reportedValue("x".repeat(PREVIEW_LENGTH * 2), LIMIT)).toEqual({
      __hkpTooLarge: {
        type: "string",
        bytes: PREVIEW_LENGTH * 2,
        exact: false,
        preview: "x".repeat(PREVIEW_LENGTH),
      },
    });
  });

  it("is bytes described by their size alone", () => {
    expect(reportedValue(new Uint8Array(LIMIT + 1), LIMIT)).toEqual({
      __hkpTooLarge: { type: "binary", bytes: LIMIT + 1, exact: true },
    });
  });

  it("is JSON, counted only until it passes the limit, with how it begins", () => {
    const reported = reportedValue(
      { items: Array.from({ length: 50 }, (_, i) => `item-${i}`) },
      LIMIT,
    ) as any;
    expect(reported.__hkpTooLarge).toMatchObject({ type: "json", exact: false });
    expect(reported.__hkpTooLarge.bytes).toBeGreaterThan(LIMIT);
    expect(reported.__hkpTooLarge.preview.startsWith('{"items":["item-0","item-1"')).toBe(true);
  });

  it("is judged without visiting all of it", () => {
    const huge = new Array(10_000_000).fill(1);
    const started = Date.now();
    const reported = reportedValue(huge) as any;
    expect(Date.now() - started).toBeLessThan(200);
    expect(reported.__hkpTooLarge).toMatchObject({ type: "json", exact: false });
  });

  it("has a preview of at most its length, ending in an ellipsis", () => {
    const reported = reportedValue({ text: "y".repeat(5000) }, LIMIT) as any;
    expect(reported.__hkpTooLarge.preview).toBe(
      `{"text":"${"y".repeat(PREVIEW_LENGTH - 9)}…`,
    );
  });
});

describe("a description", () => {
  it("is told apart from a value", () => {
    expect(isTooLarge({ __hkpTooLarge: { type: "json", bytes: 1, exact: false } })).toBe(true);
    expect(isTooLarge({ tooLarge: true })).toBe(false);
    expect(isTooLarge([{ __hkpTooLarge: {} }])).toBe(false);
    expect(isTooLarge(null)).toBe(false);
  });
});

describe("the reports the browser runtime makes", () => {
  it("describe a value above the limit, either side of a call", () => {
    const notify = vi.fn();
    const app = { notify } as any;
    const big = "z".repeat(CALL_REPORT_LIMIT + 1);

    const call = onServiceProcess(app, { uuid: "svc" } as any, big);
    onServiceResult(app, { uuid: "svc" } as any, big, call);

    const [[, began], [, ended]] = notify.mock.calls;
    expect(began.__internal.data.__hkpTooLarge).toMatchObject({ type: "string" });
    expect(ended.__internal.data.__hkpTooLarge).toMatchObject({ type: "string" });
  });
});

// Kept identical to hkp-node's, which is what makes the two runtimes describe
// a value alike. Skipped where the checkout has no hkp-node beside it.
const twin = "../hkp-node/src/callReport.ts";
describe.skipIf(!existsSync(twin))("the copy in hkp-node", () => {
  it("is this file, unchanged", () => {
    expect(readFileSync("src/runtime/callReport.ts", "utf8")).toBe(
      readFileSync(twin, "utf8"),
    );
  });
});
