import { describe, expect, it } from "vitest";

import { editedValue, readCallReport } from "../flowRecords";

/**
 * Reading a call report the way the flow inspector does — on the desktop in
 * each service frame, on a phone for the whole board — so the two agree about
 * what a call carried, and about when a call passed nothing on.
 */

const report = (internal: Record<string, unknown>) => ({ __internal: internal });

describe("reading a call report", () => {
  it("keeps what a call was given", () => {
    expect(
      readCallReport(report({ state: "call-process", call: 3, data: { a: 1 } })),
    ).toEqual({ phase: "start", call: 3, input: { data: { a: 1 } } });
  });

  it("keeps no input for a call given nothing", () => {
    // A service emitting on its own, hkp-rt's word for no value, and a report
    // without Capture mode, which carries none at all.
    for (const internal of [
      { state: "call-process", data: null },
      { state: "call-process", data: "<undefined>" },
      { state: "call-process" },
    ]) {
      expect(readCallReport(report(internal))).toEqual({
        phase: "start",
        call: undefined,
      });
    }
  });

  it("keeps what a call passed on", () => {
    expect(
      readCallReport(report({ state: "call-process-finished", call: 3, data: "x" })),
    ).toEqual({ phase: "finish", call: 3, stopped: false, output: { data: "x" } });
  });

  it("tells a call that passed nothing on, with and without its value", () => {
    expect(
      readCallReport(report({ state: "call-process-finished", data: null })),
    ).toEqual({ phase: "finish", call: undefined, stopped: true });
    // Without Capture mode the report says so in a flag of its own.
    expect(
      readCallReport(report({ state: "call-process-finished", stopped: true })),
    ).toEqual({ phase: "finish", call: undefined, stopped: true });
    expect(
      readCallReport(report({ state: "call-process-finished" })),
    ).toEqual({ phase: "finish", call: undefined, stopped: false });
  });

  it("is not fooled by any other notification", () => {
    expect(readCallReport({ bypass: true })).toBeNull();
    expect(readCallReport(report({ state: "something-else" }))).toBeNull();
    expect(readCallReport(undefined)).toBeNull();
  });
});

describe("an edited value", () => {
  it("is JSON where it is JSON, and text otherwise", () => {
    expect(editedValue('{"a": [1, 2]}')).toEqual({ a: [1, 2] });
    expect(editedValue("12")).toBe(12);
    expect(editedValue("hello")).toBe("hello");
  });
});
