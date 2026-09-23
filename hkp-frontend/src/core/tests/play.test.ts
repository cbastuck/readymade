import { describe, expect, it, vi } from "vitest";

import { canPlay, play } from "../play";
import {
  RuntimeApiMap,
  RuntimeDescriptor,
  RuntimeScope,
} from "hkp-frontend/src/types";

function board(runtimes: Array<Partial<RuntimeDescriptor>>) {
  const processRuntime = vi.fn();
  const scopes: { [id: string]: RuntimeScope } = {};
  for (const runtime of runtimes) {
    scopes[runtime.id!] = { id: runtime.id } as unknown as RuntimeScope;
  }
  return {
    processRuntime,
    board: {
      runtimes: runtimes as RuntimeDescriptor[],
      scopes,
      runtimeApis: { browser: { processRuntime } } as unknown as RuntimeApiMap,
    },
  };
}

describe("play", () => {
  it("enters the board at the runtime the chain starts in", () => {
    const { board: subject, processRuntime } = board([
      { id: "ui", type: "browser" },
      { id: "node", type: "browser" },
    ]);

    expect(play(subject, { tick: 1 })).toBe(true);
    expect(processRuntime).toHaveBeenCalledTimes(1);
    expect(processRuntime.mock.calls[0][0]).toBe(subject.scopes.ui);
    expect(processRuntime.mock.calls[0][1]).toEqual({ tick: 1 });
  });

  it("gives the first service nothing when it was given nothing", () => {
    const { board: subject, processRuntime } = board([
      { id: "ui", type: "browser" },
    ]);

    play(subject);
    // Not an empty object: a service that answers an empty input with its own
    // configuration would send that and call it the payload.
    expect(processRuntime.mock.calls[0][1]).toBeUndefined();
  });

  it("says when there is nothing to run", () => {
    const { board: empty } = board([]);
    expect(canPlay(empty)).toBe(false);
    expect(play(empty)).toBe(false);

    // A runtime that is still being restored has no scope to be asked yet,
    // which reads from here the same as a board with none.
    const { board: restoring, processRuntime } = board([
      { id: "ui", type: "browser" },
    ]);
    restoring.scopes = {};
    expect(canPlay(restoring)).toBe(false);
    expect(play(restoring)).toBe(false);
    expect(processRuntime).not.toHaveBeenCalled();
  });
});
