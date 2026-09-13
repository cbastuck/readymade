import { beforeEach, describe, expect, it, vi } from "vitest";

import BrowserRuntimeScope from "hkp-frontend/src/runtime/browser/BrowserRuntimeScope";
import BrowserRegistry from "hkp-frontend/src/runtime/browser/BrowserRegistry";
import {
  addService,
  configureService,
  processService,
} from "hkp-frontend/src/runtime/browser/BrowserRuntimeApi";
import { RuntimeDescriptor } from "hkp-frontend/src/types";

/**
 * The HTTP Client inside a real runtime, rather than against a mock app.
 *
 * The service's whole shape follows from one fact — the response does not exist
 * when the push passes through it — and that fact only shows up with a pipeline
 * behind it: the services after it must not be called with nothing, and must be
 * called with the response once there is one. This is that, end to end, with
 * only the network replaced.
 */

async function createScope() {
  const runtime: RuntimeDescriptor = {
    id: "rt-http-1",
    name: "Browser Runtime",
    type: "browser",
  };
  const registry = await BrowserRegistry.create();
  return new BrowserRuntimeScope(runtime, registry);
}

/** A service that records what reached it, to stand in for the rest of a board. */
function recordingService(uuid: string, seen: unknown[]) {
  return {
    uuid,
    board: "test-board",
    app: null,
    serviceId: `test/${uuid}`,
    serviceName: uuid,
    configure: vi.fn(),
    process: vi.fn((input: unknown) => {
      seen.push(input);
      return input;
    }),
    destroy: vi.fn(),
    bypass: false,
  } as any;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

describe("http-client in a browser runtime", () => {
  it("is a service the browser registry can build", async () => {
    const scope = await createScope();

    const descriptor = await addService(
      scope as any,
      { serviceId: "http-client", serviceName: "Request" } as any,
      "request",
    );

    expect(descriptor).not.toBeNull();
    expect(scope.findServiceInstance("request")[0]).toBeDefined();
  });

  it("calls the services behind it with the response, once there is one", async () => {
    const scope = await createScope();
    const seen: unknown[] = [];
    const results: unknown[] = [];
    scope.onResult = async (_uuid, result) => {
      results.push(result);
    };

    await addService(
      scope as any,
      { serviceId: "http-client", serviceName: "Request" } as any,
      "request",
    );
    scope.appendService(recordingService("response", seen));
    await configureService(
      scope as any,
      { uuid: "request" } as any,
      { url: "https://api.example.com", path: "/zen" },
    );

    let respond: (response: Response) => void = () => {};
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => (respond = resolve)),
    );

    processService(scope as any, { uuid: "request" } as any, undefined);

    // The push has passed through: the request is out, and nothing was handed
    // on — a response it does not have yet cannot be the pipeline's value.
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(seen).toEqual([]);

    respond(
      new Response(new TextEncoder().encode('{"hello":"board"}'), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await vi.waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]).toMatchObject({
      meta: { status: 200, url: "https://api.example.com/zen" },
      body: { hello: "board" },
    });
    // And the runtime's own result is the response too, so a board's next
    // runtime is reached rather than left waiting.
    expect(results[results.length - 1]).toMatchObject({
      body: { hello: "board" },
    });
  });

  it("leaves the pipeline alone when the request fails", async () => {
    const scope = await createScope();
    const seen: unknown[] = [];

    await addService(
      scope as any,
      { serviceId: "http-client", serviceName: "Request" } as any,
      "request",
    );
    scope.appendService(recordingService("response", seen));
    await configureService(
      scope as any,
      { uuid: "request" } as any,
      { url: "https://api.example.com" },
    );

    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    processService(scope as any, { uuid: "request" } as any, undefined);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await Promise.resolve();
    expect(seen).toEqual([]);
  });
});
