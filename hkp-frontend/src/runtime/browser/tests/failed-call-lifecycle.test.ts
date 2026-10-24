import { describe, expect, it, vi } from "vitest";

import api from "../BrowserRuntimeApi";
import BrowserRuntimeScope from "../BrowserRuntimeScope";
import { ServiceInstance } from "hkp-frontend/src/types";

/**
 * A call that fails is over all the same: it is reported finished, with
 * nothing produced. What shows a service running counts the calls still open,
 * so a failed call that never said it ended would show it running for good.
 */

const lifecycle = (calls: any[][]) =>
  calls
    .map(([notification]) => notification?.__internal)
    .filter((internal) => internal?.state?.startsWith("call-process"));
const withoutCall = (internals: any[]) =>
  internals.map(({ state, data }) => ({ state, data }));

describe("a call that fails", () => {
  it("is reported finished, with nothing produced", async () => {
    const { scope: scope_ } = await api.addRuntime(
      { name: "Browser", type: "browser" } as any,
      null,
      "test-board",
    );
    const scope = scope_ as BrowserRuntimeScope;
    scope.onResult = async () => {};
    const added = await api.addService(scope, {
      serviceId: "hookup.to/service/monitor",
      serviceName: "Failing",
    } as any);
    const svc = scope.findServiceInstance(added!.uuid)[0] as ServiceInstance;
    svc.process = async () => {
      throw new Error("broken");
    };
    const target = vi.fn();
    scope.app.registerNotificationTarget!(svc, target);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await scope.next(null, { n: 1 }, null, false);

    const [started, finished] = lifecycle(target.mock.calls);
    expect(withoutCall([started, finished])).toEqual([
      { state: "call-process", data: { n: 1 } },
      { state: "call-process-finished", data: null },
    ]);
    // Its end is reported as the end of that call.
    expect(finished.call).toBe(started.call);
  });
});
