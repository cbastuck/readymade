import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import api from "../BrowserRuntimeApi";
import BrowserRuntimeScope from "../BrowserRuntimeScope";
import { setCapturing } from "../../captureMode";
import { ServiceInstance } from "hkp-frontend/src/types";

/**
 * `app.rerun` — the flow inspector's Rerun on the Input side. Unlike a replay
 * through `next`, the service itself is called again, so it reports the input
 * and the output of that call like any other, and the services after it run.
 */

async function twoServices() {
  const { scope: scope_ } = await api.addRuntime(
    { name: "Browser", type: "browser" } as any,
    null,
    "test-board",
  );
  const scope = scope_ as BrowserRuntimeScope;
  scope.onResult = async () => {};

  const first = await api.addService(scope, {
    serviceId: "hookup.to/service/monitor",
    serviceName: "First",
  } as any);
  const second = await api.addService(scope, {
    serviceId: "hookup.to/service/monitor",
    serviceName: "Second",
  } as any);

  return {
    scope,
    first: scope.findServiceInstance(first!.uuid)[0] as ServiceInstance,
    second: scope.findServiceInstance(second!.uuid)[0] as ServiceInstance,
  };
}

// What a call was handed and what it answered; which call it was is left out.
const lifecycle = (calls: any[][]) =>
  calls
    .map(([notification]) => notification?.__internal)
    .filter((internal) => internal?.state?.startsWith("call-process"))
    .map(({ state, data }) => ({ state, data }));

describe("app.rerun", () => {
  // About the values a frame is shown, which reports carry in Capture mode.
  beforeEach(() => setCapturing(true));
  afterEach(() => setCapturing(false));

  it("calls the service itself with the input, and the services after it", async () => {
    const { scope, first, second } = await twoServices();
    const atFirst = vi.fn();
    const atSecond = vi.fn();
    scope.app.registerNotificationTarget!(first, atFirst);
    scope.app.registerNotificationTarget!(second, atSecond);

    scope.app.rerun!(first, { n: 1 });

    await vi.waitFor(() =>
      expect(lifecycle(atSecond.mock.calls)).toContainEqual({
        state: "call-process",
        data: { n: 1 },
      }),
    );
    expect(lifecycle(atFirst.mock.calls)).toEqual([
      { state: "call-process", data: { n: 1 } },
      { state: "call-process-finished", data: { n: 1 } },
    ]);
  });
});
