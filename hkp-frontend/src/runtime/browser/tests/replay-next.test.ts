import { describe, expect, it, vi } from "vitest";

import api from "../BrowserRuntimeApi";
import BrowserRuntimeScope from "../BrowserRuntimeScope";
import { ServiceInstance } from "hkp-frontend/src/types";

/**
 * What `app.next` reports about the service it is called on.
 *
 * A service emitting on its own — a Timer tick, an arriving message — was never
 * called by the pipeline's loop, so nothing else reports the output it just
 * produced and `next` reports it on the service's behalf. A replay is the case
 * with nothing to report: the flow inspector is pushing a captured value back
 * through the board, so the service produced nothing, and counting it would add
 * a history entry to the inspector for every click of its own Inject button —
 * which is not what the remote runtimes do.
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

/** The pair of notifications a produced output is reported with. */
const outputReports = (calls: any[][]) =>
  calls.filter(
    ([notification]) =>
      notification?.__internal?.state === "call-process-finished",
  );

describe("app.next", () => {
  it("reports the output of a service that emitted on its own", async () => {
    const { scope, first } = await twoServices();
    const onNotification = vi.fn();
    scope.app.registerNotificationTarget!(first, onNotification);

    await scope.app.next(first, { tick: 1 });

    expect(outputReports(onNotification.mock.calls)).toEqual([
      [{ __internal: { state: "call-process-finished", data: { tick: 1 } } }],
    ]);
  });

  it("reports nothing for the service a value is replayed from", async () => {
    const { scope, first } = await twoServices();
    const onNotification = vi.fn();
    scope.app.registerNotificationTarget!(first, onNotification);

    await scope.app.next(first, { tick: 1 }, { replay: true });
    await scope.app.next(first, { tick: 1 }, { replay: true });

    expect(outputReports(onNotification.mock.calls)).toEqual([]);
  });

  it("still runs the services after it on a replay", async () => {
    const { scope, first, second } = await twoServices();
    const onNotification = vi.fn();
    scope.app.registerNotificationTarget!(second, onNotification);

    await scope.app.next(first, { tick: 1 }, { replay: true });

    expect(onNotification).toHaveBeenCalledWith({ tick: 1 });
  });
});
