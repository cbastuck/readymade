import { afterEach, describe, expect, it, vi } from "vitest";

import restApi, {
  describeRuntimeServer,
  introduceRuntimeServer,
} from "../RuntimeRestApi";
import { setSecretStore } from "hkp-frontend/src/core/secrets";
import {
  SecretRelease,
  resetSecretConsent,
  setSecretConsent,
} from "hkp-frontend/src/core/secretConsent";
import { RuntimeDescriptor, ServiceDescriptor } from "hkp-frontend/src/types";

/**
 * What this client asks of a runtime server on the way to deploying a board:
 * what it is, and to connect to a coordinator.
 */

const user = { idToken: "token-1" };

function answer(status: number, body: unknown = {}) {
  const fetchMock = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify(body), { status }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  setSecretStore(null);
  resetSecretConsent();
});

describe("asking a runtime server what it is", () => {
  it("reads its kind, its registry and whether it can join a coordinator", async () => {
    const fetchMock = answer(200, {
      runtimes: [],
      registry: [{ serviceId: "monitor", serviceName: "Monitor" }],
      server: "python",
      coordinatorLinks: true,
      boardRuntimes: true,
    });

    expect(await describeRuntimeServer("http://studio:5000", user)).toEqual({
      status: "ok",
      kind: "python",
      registry: [{ serviceId: "monitor", serviceName: "Monitor" }],
      coordinatorLinks: true,
      boardRuntimes: true,
    });
    expect(fetchMock).toHaveBeenCalledWith("http://studio:5000/runtimes", {
      headers: { Authorization: "Bearer token-1" },
    });
  });

  it("takes a server that does not say it can join as one that cannot", async () => {
    answer(200, { runtimes: [], registry: [], server: "c++" });

    expect(await describeRuntimeServer("http://rt:8887", user)).toMatchObject({
      status: "ok",
      kind: "c++",
      coordinatorLinks: false,
      boardRuntimes: false,
    });
  });

  it("tells a server that turned the person away from one that is not there", async () => {
    answer(401);
    expect((await describeRuntimeServer("http://h", user)).status).toBe(
      "refused",
    );

    answer(500);
    expect((await describeRuntimeServer("http://h", user)).status).toBe(
      "unreachable",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    expect(await describeRuntimeServer("http://h", user)).toEqual({
      status: "unreachable",
      detail: "Failed to fetch",
    });
  });

  it("sends no credentials it does not have", async () => {
    const fetchMock = answer(200, {});

    await describeRuntimeServer("http://h", null);

    expect(fetchMock).toHaveBeenCalledWith("http://h/runtimes", { headers: {} });
  });
});

describe("introducing a runtime server to a coordinator", () => {
  const introduction = {
    coordinatorUrl: "https://cloud.example/coordinator",
    ticket: "hkpt_ticket",
    boardName: "Doorbell",
    runtimeId: "node",
    secrets: { "imap.password": { value: "s3cret" } },
  };

  it("hands over the ticket and the coordinator's address, as the person", async () => {
    const fetchMock = answer(201, { connected: true });

    await introduceRuntimeServer("http://laptop:8080", user, introduction);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://laptop:8080/coordinator-links");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual(introduction);
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer token-1",
    );
  });

  it("passes on why the runtime server could not connect", async () => {
    answer(502, { error: "the coordinator did not accept the ticket" });

    await expect(
      introduceRuntimeServer("http://laptop:8080", user, introduction),
    ).rejects.toThrow(
      "its runtime server could not connect to the coordinator — the coordinator did not accept the ticket",
    );
  });

  it("says a runtime server without the route cannot connect to a coordinator", async () => {
    answer(404);

    await expect(
      introduceRuntimeServer("http://laptop:8080", user, introduction),
    ).rejects.toThrow("its runtime server cannot connect to a coordinator");
  });

  it("says the runtime server could not be reached when it does not answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    await expect(
      introduceRuntimeServer("http://laptop:8080", user, introduction),
    ).rejects.toThrow(/could not be reached \(Failed to fetch\)/);
  });
});

describe("consent for a runtime that names a remote", () => {
  // A remote's name is board-controlled and resolves differently for each
  // person. Consent is therefore asked — and remembered — against the address
  // the name resolved to on this client, exactly as for an authored address.
  const services = [
    {
      uuid: "imap-1",
      serviceId: "imap-email",
      serviceName: "IMAP Email",
      state: { password: "{{secret.gmail.imap}}" },
    },
  ] as Array<ServiceDescriptor>;

  function provisionable() {
    return vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return new Response(
          JSON.stringify({
            runtimes: [{ id: "node", name: "Node", services: [], outputUrl: "" }],
            registry: [],
          }),
        );
      }
      void url;
      return new Response(JSON.stringify({ runtimes: [], registry: [] }));
    });
  }

  it("is asked for the address the name resolved to, not for the name", async () => {
    setSecretStore({
      get: (alias: string) => (alias === "gmail.imap" ? "hunter2" : null),
      list: () => ["gmail.imap"],
    });
    const asked: SecretRelease[] = [];
    setSecretConsent({
      prompt: async (request) => {
        asked.push(request);
        return { allowed: request.aliases, remember: false };
      },
      grants: { granted: () => [], grant: () => {} },
    });
    vi.stubGlobal("fetch", provisionable());

    // The runtime as it is restored: the name it was authored with, and the
    // address that name resolved to here.
    await restApi.restoreRuntime(
      {
        id: "node",
        name: "Node",
        type: "rest",
        remote: "Studio",
        url: "http://studio:5000",
      } as RuntimeDescriptor,
      services,
      null,
      "Mail",
    );

    expect(asked).toHaveLength(1);
    expect(asked[0].url).toBe("http://studio:5000");
    expect(JSON.stringify(asked[0])).not.toContain("Studio");
  });

  it("is asked again when the same name resolves to another server", async () => {
    setSecretStore({
      get: () => "hunter2",
      list: () => ["gmail.imap"],
    });
    const granted = new Map<string, string[]>();
    const asked: string[] = [];
    setSecretConsent({
      prompt: async (request) => {
        asked.push(request.url);
        return { allowed: request.aliases, remember: true };
      },
      grants: {
        granted: (key) => granted.get(key) ?? [],
        grant: (key, aliases) => {
          granted.set(key, aliases);
        },
      },
    });
    vi.stubGlobal("fetch", provisionable());
    const named = (url: string) =>
      ({ id: "node", name: "Node", type: "rest", remote: "Studio", url }) as RuntimeDescriptor;

    await restApi.restoreRuntime(named("http://studio:5000"), services, null, "Mail");
    await restApi.restoreRuntime(named("http://studio:5000"), services, null, "Mail");
    // The same board, the same name — on a client where it means another machine.
    await restApi.restoreRuntime(named("http://elsewhere:5000"), services, null, "Mail");

    expect(asked).toEqual(["http://studio:5000", "http://elsewhere:5000"]);
  });
});
