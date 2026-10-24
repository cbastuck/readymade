import { describe, expect, it, vi } from "vitest";

import { forwardResult } from "../Board/forwardResult";
import { ProcessContext, RuntimeDescriptor } from "../../../types";

/**
 * What a cloud board hands its coordinator. The case worth pinning is the one
 * the playground already had: a run that stopped in a browser runtime has
 * nothing for the next one, and must not start it on nothing.
 */

const browser = { id: "ui", name: "Browser", type: "browser" } as RuntimeDescriptor;
const person = {
  runId: "r",
  actor: { kind: "person", expiresAt: Date.now() + 60_000 },
} as unknown as ProcessContext;

function socket() {
  return { readyState: WebSocket.OPEN, send: vi.fn() };
}

describe("a browser runtime's result on a cloud board", () => {
  it("goes to the coordinator when it carries something", () => {
    const ws = socket();

    forwardResult(ws, browser, { item: "a" }, person);

    expect(ws.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
      type: "result-from-browser",
      runtimeId: "ui",
      data: { item: "a" },
    });
  });

  it("is not sent when the run stopped", () => {
    const ws = socket();

    forwardResult(ws, browser, null, person);

    expect(ws.send).not.toHaveBeenCalled();
  });

  it("answers a call the coordinator made, even with nothing", () => {
    // The coordinator is waiting on that answer; null is one.
    const ws = socket();
    const onResolve = vi.fn();

    forwardResult(ws, browser, null, { ...person, onResolve });

    expect(onResolve).toHaveBeenCalledWith(null);
    expect(ws.send).not.toHaveBeenCalled();
  });
});
