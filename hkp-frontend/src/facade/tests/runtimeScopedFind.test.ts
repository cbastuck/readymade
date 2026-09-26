import { describe, expect, it, vi } from "vitest";

import { findService } from "../boardServices";
import type { BoardContextState } from "hkp-frontend/src/BoardContext";

/**
 * A uuid is unique only within its runtime — two runtimes may each hold a
 * service called `intake`, which is what composing boards from units relies
 * on. A caller that knows which runtime holds the service says so, and gets
 * that one rather than whichever runtime happens to be asked first.
 */

const inBrowser = { uuid: "intake", runtime: "ui" };

function context(): BoardContextState {
  return {
    scopes: {
      ui: {
        findServiceInstance: (uuid: string) =>
          uuid === "intake" ? [inBrowser] : [],
      },
      node: { app: {} },
    },
    services: {
      ui: [{ uuid: "intake", serviceId: "sub-service", state: { in: "ui" } }],
      node: [
        { uuid: "intake", serviceId: "sub-service", state: { in: "node" } },
      ],
    },
    runtimes: [
      { id: "ui", type: "browser" },
      { id: "node", type: "rest", url: "http://127.0.0.1:8080" },
    ],
    runtimeApis: { rest: { configureService: vi.fn() } },
  } as unknown as BoardContextState;
}

describe("finding a service whose uuid two runtimes share", () => {
  it("finds the one on the runtime named", () => {
    expect(findService(context(), "intake", "node")?.state).toEqual({
      in: "node",
    });
    expect(findService(context(), "intake", "ui")).toBe(inBrowser);
  });

  it("finds a nested address only on the runtime named", () => {
    expect(findService(context(), "intake.inner", "node")?.uuid).toBe(
      "intake.inner",
    );
    expect(findService(context(), "intake.inner", "ui")).toBeNull();
  });

  it("answers from the first runtime holding it when none is named", () => {
    expect(findService(context(), "intake")).toBe(inBrowser);
  });

  it("refuses an address inside a use only on the use's own runtime", () => {
    const withUse = {
      ...context(),
      linkage: {
        units: [],
        views: [],
        blocks: {
          definitions: {},
          placed: [
            {
              key: "k",
              runtimeId: "ui",
              path: [],
              address: "intake",
              id: "intake",
              use: { block: "note" },
              document: "",
            },
          ],
        },
      },
    } as unknown as BoardContextState;
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(findService(withUse, "intake.inner", "ui")).toBeNull();
    expect(findService(withUse, "intake.inner", "node")?.uuid).toBe(
      "intake.inner",
    );
  });
});
