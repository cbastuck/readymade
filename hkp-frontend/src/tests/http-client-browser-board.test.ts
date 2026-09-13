import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { defaultRegistry } from "../runtime/browser/registry/Default";

/**
 * The browser variant of the HTTP Client demo.
 *
 * It exists to be the same app with one thing taken away — the runtime — so the
 * facade is not its own design but the other board's, and the test that matters
 * is that they have not drifted apart. What it may not share is the engine: the
 * services it names have to be ones the browser itself provides, or the board
 * loads into a runtime that cannot run it.
 */

function board(name: string) {
  return JSON.parse(readFileSync(`boards/${name}`, "utf-8"));
}

const browserBoard = board("http-client-browser-demo-board.json");
const nodeBoard = board("http-client-demo-board.json");

describe("the browser HTTP Client demo board", () => {
  it("presents the same app as the board that needs a runtime", () => {
    expect(browserBoard.facade).toEqual(nodeBoard.facade);
  });

  it("runs on the browser alone", () => {
    expect(browserBoard.runtimes).toHaveLength(1);
    expect(browserBoard.runtimes[0].type).toBe("browser");
    expect(Object.keys(browserBoard.services)).toEqual([
      browserBoard.runtimes[0].id,
    ]);
  });

  it("names only services the browser registry provides", () => {
    const available = new Set(defaultRegistry.map((svc) => svc.serviceId));
    for (const services of Object.values(browserBoard.services) as any[]) {
      for (const svc of services) {
        expect(available, svc.serviceId).toContain(svc.serviceId);
      }
    }
  });

  it("makes the request with the same service the other runtimes have", () => {
    const request = browserBoard.services.ui.find(
      (svc: any) => svc.uuid === "request",
    );
    expect(request.serviceId).toBe("http-client");
    // The facade drives this service by uuid, so the two boards' widgets stay
    // interchangeable only while the uuids do.
    expect(browserBoard.services.ui.map((svc: any) => svc.uuid)).toEqual(
      nodeBoard.services.node.map((svc: any) => svc.uuid),
    );
  });
});
