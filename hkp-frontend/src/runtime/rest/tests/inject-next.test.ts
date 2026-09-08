import { afterEach, describe, expect, it, vi } from "vitest";

import RuntimeRestScope from "../RuntimeRestScope";
import { RuntimeDescriptor, ServiceDescriptor } from "hkp-frontend/src/types";

/**
 * `app.next` on a remote runtime means the same thing it means on the browser
 * one: the services *after* the caller run, with the value the caller emitted.
 *
 * It used to post to the runtime-wide entry point, which always starts at the
 * first service — so a value pushed from the middle of a pipeline (the flow
 * inspector's "Inject data", a Monitor's "Inject Buffer") was fed to the head of
 * the pipeline instead, and whatever ran there replaced it long before the
 * service after the caller saw anything.
 */

const runtime: RuntimeDescriptor = {
  id: "process",
  name: "Node",
  type: "rest",
  url: "http://127.0.0.1:8080",
} as RuntimeDescriptor;

const services = [
  { uuid: "as-prompt", serviceId: "map", serviceName: "As Prompt" },
  { uuid: "extract", serviceId: "text-generation", serviceName: "Extract" },
  { uuid: "result", serviceId: "monitor", serviceName: "Extracted" },
] as Array<ServiceDescriptor>;

function makeScope() {
  // No output URL: the scope then opens no WebSocket, so every call goes REST.
  const scope = new RuntimeRestScope(runtime, "", null);
  scope.services = services;
  scope.onResult = vi.fn();
  return scope;
}

const ok = { ok: true, status: 200, statusText: "OK", text: async () => "null" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RuntimeRestApp.next", () => {
  it("hands the emitted value to the service after the caller", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok);
    vi.stubGlobal("fetch", fetchMock);

    const scope = makeScope();
    scope.app.next({ uuid: "extract" }, { offer: "42" });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://127.0.0.1:8080/runtimes/process/services/result/process",
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ offer: "42" });
  });

  it("reports the result onward when the caller is the last service", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok);
    vi.stubGlobal("fetch", fetchMock);

    const scope = makeScope();
    scope.app.next({ uuid: "result" }, { offer: "42" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(scope.onResult).toHaveBeenCalledWith("result", { offer: "42" }, null);
  });

  it("runs the whole runtime when there is no calling service", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok);
    vi.stubGlobal("fetch", fetchMock);

    const scope = makeScope();
    scope.app.next(null, { offer: "42" });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://127.0.0.1:8080/runtimes/process",
    );
  });
});
