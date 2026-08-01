import { afterEach, describe, expect, it, vi } from "vitest";

import restApi from "../RuntimeRestApi";
import { RuntimeDescriptor, ServiceDescriptor } from "hkp-frontend/src/types";

/**
 * Restoring a board asks before it posts.
 *
 * "Attach" and "provision" are different intents that used to travel as the same
 * call: the browser posted the board whether or not the runtime existed, and
 * each runtime guessed what was meant — hkp-node reused the running runtime,
 * hkp-python and hkp-rt rebuilt it. Asking first says which is meant, in plain
 * verbs: GET to attach, POST to provision.
 */

const runtime: RuntimeDescriptor = {
  id: "node",
  name: "Node",
  type: "rest",
  url: "http://127.0.0.1:8080",
} as RuntimeDescriptor;

const boardServices = [
  { uuid: "timer-1", serviceId: "timer", serviceName: "Timer" },
  { uuid: "mon-1", serviceId: "monitor", serviceName: "Monitor" },
] as Array<ServiceDescriptor>;

/** A GET /runtimes body listing the runtimes the server has, plus its registry. */
function listing(runtimes: Array<Record<string, unknown>>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      runtimes,
      registry: [{ serviceId: "timer", serviceName: "Timer" }],
    }),
  };
}

const running = (services: Array<Record<string, unknown>>) => ({
  id: "node",
  name: "Node",
  services,
  outputUrl: "ws://127.0.0.1:8080/node",
});

function mockFetch(handler: (url: string, init?: any) => any) {
  const fetchMock = vi.fn(async (url: string, init?: any) => handler(url, init));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The verbs each call used, in order — the whole point of these tests. */
const verbs = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.mock.calls.map(
    ([url, init]: any) => `${init?.method ?? "GET"} ${new URL(url).pathname}`,
  );

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("restoring a runtime that is already running", () => {
  it("attaches to it instead of posting the board", async () => {
    // A page reload, or a second viewer of a board someone else started.
    const fetchMock = mockFetch((url) => {
      if (url.endsWith("/runtimes")) {
        return listing([running(boardServices as unknown as Array<Record<string, unknown>>)]);
      }
      throw new Error(`unexpected request: ${url}`);
    });

    const result = await restApi.restoreRuntime(runtime, boardServices, null, "b");

    expect(verbs(fetchMock)).toEqual(["GET /runtimes"]);
    expect(result?.services).toEqual(boardServices);
    expect(result?.scope).toBeTruthy();
  });

  it("keeps the state the running services report, not the board's", async () => {
    // The reason attaching matters: a mount address is assigned at provision
    // time and only the running service knows it.
    const live = [
      { uuid: "timer-1", serviceId: "timer", state: { counter: 41 } },
      { uuid: "mon-1", serviceId: "monitor", state: {} },
    ];
    mockFetch((url) =>
      url.endsWith("/runtimes") ? listing([running(live)]) : null,
    );

    const result = await restApi.restoreRuntime(runtime, boardServices, null, "b");

    expect((result?.services?.[0] as any).state).toEqual({ counter: 41 });
  });
});

describe("restoring a runtime that is not running", () => {
  it("provisions it", async () => {
    const fetchMock = mockFetch((url, init) => {
      if (url.endsWith("/runtimes") && !init?.method) {
        return listing([]); // nothing under this id yet
      }
      if (url.endsWith("/runtimes") && init?.method === "POST") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            runtimes: [running(boardServices as unknown as Array<Record<string, unknown>>)],
            registry: [],
          }),
        };
      }
      throw new Error(`unexpected request: ${url}`);
    });

    await restApi.restoreRuntime(runtime, boardServices, null, "b");

    expect(verbs(fetchMock)).toEqual(["GET /runtimes", "POST /runtimes"]);
  });

  it("provisions when the running services are not this board's", async () => {
    // Same id, different board — or a board whose services were edited. The
    // running runtime is not the one being restored, so it is replaced. Only
    // the client can make this call; the server cannot tell the difference.
    const fetchMock = mockFetch((url, init) => {
      if (url.endsWith("/runtimes") && !init?.method) {
        return listing([
          running([{ uuid: "something-else", serviceId: "monitor" }]),
        ]);
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ runtimes: [running([])], registry: [] }),
      };
    });

    await restApi.restoreRuntime(runtime, boardServices, null, "b");

    expect(verbs(fetchMock)).toEqual(["GET /runtimes", "POST /runtimes"]);
  });

  it("provisions when the runtime server cannot be asked", async () => {
    // Unreachable, or answering something that is not a runtime listing:
    // provisioning reports the failure with a better message than this path
    // could.
    const fetchMock = mockFetch((url, init) => {
      if (!init?.method) {
        throw new Error("connection refused");
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ runtimes: [running([])], registry: [] }),
      };
    });

    await restApi.restoreRuntime(runtime, boardServices, null, "b");

    expect(verbs(fetchMock)).toEqual(["GET /runtimes", "POST /runtimes"]);
  });
});
