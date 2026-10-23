import { afterEach, describe, expect, it, vi } from "vitest";

import RuntimeRestScope from "../RuntimeRestScope";
import { RuntimeDescriptor, ServiceDescriptor } from "hkp-frontend/src/types";

/**
 * `app.next` on a remote runtime means the same thing it means on the browser
 * one: the services *after* the caller run, with the value the caller emitted.
 *
 * It used to post to the runtime-wide entry point, which always starts at the
 * first service — so a value pushed from the middle of a pipeline (the flow
 * inspector's "Inject", a Monitor's "Inject Buffer") was fed to the head of
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

/**
 * `app.rerun` — the flow inspector's Rerun on the Input side: the service
 * itself runs again with the input, and what follows it after.
 */
describe("RuntimeRestApp.rerun", () => {
  it("starts the run at the service itself", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok);
    vi.stubGlobal("fetch", fetchMock);

    const scope = makeScope();
    scope.app.rerun!({ uuid: "extract" }, { prompt: "42" });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://127.0.0.1:8080/runtimes/process/services/extract/process",
    );
    expect(JSON.parse(init.body)).toEqual({ prompt: "42" });
  });

  it("starts a nested service at its address", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok);
    vi.stubGlobal("fetch", fetchMock);

    const scope = makeScope();
    scope.app.rerun!({ uuid: "first", address: "each.first" }, { id: 1 });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://127.0.0.1:8080/runtimes/process/services/each.first/process",
    );
  });
});

/**
 * A service inside a scope — the flow inspector's Inject on a nested frame —
 * carries on in its own pipeline, not from the head of the runtime.
 */
describe("RuntimeRestApp.next inside a scope", () => {
  function scopeWithIterator() {
    const scope = new RuntimeRestScope(runtime, "", null);
    scope.services = [
      {
        uuid: "each",
        serviceId: "iterator",
        serviceName: "Each",
        state: {
          pipeline: [
            { instanceId: "first", serviceId: "monitor", state: {} },
            { instanceId: "second", serviceId: "map", state: {} },
          ],
        },
      },
      { uuid: "result", serviceId: "monitor", serviceName: "Result" },
    ] as Array<ServiceDescriptor>;
    scope.onResult = vi.fn();
    return scope;
  }

  it("runs the service after it in its pipeline, at that service's address", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok);
    vi.stubGlobal("fetch", fetchMock);

    const scope = scopeWithIterator();
    scope.app.next({ uuid: "first", address: "each.first" }, { id: 1 });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://127.0.0.1:8080/runtimes/process/services/each.second/process",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ id: 1 });
  });

  it("carries on after the scope from the last service of its pipeline", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok);
    vi.stubGlobal("fetch", fetchMock);

    const scope = scopeWithIterator();
    scope.app.next({ uuid: "second", address: "each.second" }, { id: 1 });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://127.0.0.1:8080/runtimes/process/services/result/process",
    );
  });
});
