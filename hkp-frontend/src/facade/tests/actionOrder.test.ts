import { describe, expect, it, vi } from "vitest";

import { executeActions } from "../executeActions";
import { BoardContextState } from "../../BoardContext";

/**
 * A widget's actions run in the order they are written, one at a time.
 *
 * The case this is about is a button that configures a service and then asks it
 * to do its job — the verb row of an HTTP request facade, where the method is
 * the button that was pressed. Both legs reach a remote runtime as separate
 * requests, so a configure that is merely *started* before the process lets the
 * work run against the settings the previous press left behind: press POST
 * after GET and the request still goes out as a GET.
 */

const calls: string[] = [];
let releaseConfigure: (() => void) | null = null;

vi.mock("../boardServices", () => ({
  findService: () => ({
    uuid: "request",
    configure: (config: Record<string, unknown>) =>
      new Promise<void>((resolve) => {
        calls.push(`configure ${JSON.stringify(config)}`);
        releaseConfigure = () => resolve();
      }),
  }),
  processService: (_ctx: unknown, uuid: string) => {
    calls.push(`process ${uuid}`);
  },
}));

const boardContext = {
  scopes: {},
  services: {},
  runtimes: [],
} as unknown as BoardContextState;

describe("a widget's actions", () => {
  it("does not start the work until the configuration it names has landed", async () => {
    calls.length = 0;
    releaseConfigure = null;

    const running = executeActions({
      actions: [
        { type: "configure", serviceUuid: "request", configure: { method: "post" } },
        { type: "process", serviceUuid: "request", payload: {} },
      ],
      value: undefined,
      boardContext,
      setState: () => {},
      state: {},
    });

    // The configure is in flight and the runtime has not answered yet.
    expect(calls).toEqual(['configure {"method":"post"}']);

    releaseConfigure?.();
    await running;

    expect(calls).toEqual(['configure {"method":"post"}', "process request"]);
  });
});
