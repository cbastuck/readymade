import { afterEach, describe, expect, it, vi } from "vitest";

import restApi from "../RuntimeRestApi";
import { setSecretStore } from "hkp-frontend/src/core/secrets";
import {
  SecretRelease,
  resetSecretConsent,
  setSecretConsent,
} from "hkp-frontend/src/core/secretConsent";
import { RuntimeDescriptor, ServiceDescriptor } from "hkp-frontend/src/types";

/**
 * Values reach a runtime whenever it comes to need them.
 *
 * A board carries the name of a secret; the runtime running it needs the value.
 * Provisioning is the obvious moment and not the only one — a runtime is
 * created empty, services are added to it one at a time, and a field naming a
 * secret is typed into one of them long afterwards. Every one of those has to
 * end with the value where it will be asked for, or a service fails at the
 * point of use with a credential it cannot resolve.
 */

const runtime: RuntimeDescriptor = {
  id: "node",
  name: "Node",
  type: "rest",
  url: "http://127.0.0.1:8080",
} as RuntimeDescriptor;

const withSecret = [
  {
    uuid: "imap-1",
    serviceId: "imap-email",
    serviceName: "IMAP Email",
    state: { host: "imap.example.com", password: "{{secret.gmail.imap}}" },
  },
] as Array<ServiceDescriptor>;

function storeOf(entries: Record<string, string>) {
  return {
    get: (alias: string) => entries[alias] ?? null,
    list: () => Object.keys(entries),
  };
}

function mockFetch(handler: (url: string, init?: any) => any) {
  const fetchMock = vi.fn(async (url: string, init?: any) => handler(url, init));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/**
 * The body of the call that carried one to `url`, parsed.
 *
 * Matched on having a body rather than on order: restoring asks before it
 * posts, so the same path is fetched twice and only the second says anything.
 */
function sentTo(fetchMock: ReturnType<typeof mockFetch>, match: string) {
  const call = fetchMock.mock.calls.find(
    ([url, init]) => String(url).includes(match) && (init as any)?.body,
  );
  return call?.[1]?.body ? JSON.parse(call[1].body as string) : undefined;
}

afterEach(() => {
  vi.unstubAllGlobals();
  setSecretStore(null);
});

describe("secrets reaching a remote runtime", () => {
  it("sends them with the create payload, so a service has one before it is configured", async () => {
    setSecretStore(storeOf({ "gmail.imap": "hunter2" }));
    const fetchMock = mockFetch((url) => {
      if (url.endsWith("/runtimes") ) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            runtimes: [{ id: "node", name: "Node", services: [], outputUrl: "" }],
            registry: [],
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    await restApi.restoreRuntime(runtime, withSecret, null, "Board");

    const created = sentTo(fetchMock, "/runtimes");
    expect(created.secrets).toEqual({ "gmail.imap": { value: "hunter2" } });
  });

  it("sends only what this runtime's own services ask for", async () => {
    setSecretStore(storeOf({ "gmail.imap": "hunter2", unrelated: "other" }));
    const fetchMock = mockFetch(() => ({
      ok: true,
      status: 200,
      json: async () => ({
        runtimes: [{ id: "node", name: "Node", services: [], outputUrl: "" }],
        registry: [],
      }),
    }));

    await restApi.restoreRuntime(runtime, withSecret, null, "Board");

    expect(Object.keys(sentTo(fetchMock, "/runtimes").secrets)).toEqual([
      "gmail.imap",
    ]);
  });

  it("pushes before configuring, so a service can be put to use by the same call", async () => {
    setSecretStore(storeOf({ "gmail.imap": "hunter2" }));
    const fetchMock = mockFetch(() => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }));

    const scope = {
      descriptor: runtime,
      services: withSecret,
      authenticatedUser: null,
    } as never;

    await restApi.configureService(scope, { uuid: "imap-1" } as never, {
      password: "{{secret.gmail.imap}}",
    });

    const calls = fetchMock.mock.calls.map(([url, init]) => [
      String(url),
      (init as any)?.method,
    ]);
    expect(calls).toEqual([
      ["http://127.0.0.1:8080/runtimes/node/secrets", "POST"],
      ["http://127.0.0.1:8080/runtimes/node/services/imap-1", "POST"],
    ]);
    expect(sentTo(fetchMock, "/secrets")).toEqual({
      "gmail.imap": { value: "hunter2" },
    });
  });

  it("covers a board built a service at a time, not only one restored", async () => {
    // The runtime is created before it has any services, so nothing was sent
    // with it. The value has to arrive with the configuration that names it.
    setSecretStore(storeOf({ "gmail.imap": "hunter2" }));
    const fetchMock = mockFetch(() => ({
      ok: true,
      status: 200,
      json: async () => ({ host: "imap.example.com" }),
    }));

    const scope = {
      descriptor: runtime,
      registry: [],
      services: [],
      authenticatedUser: null,
    } as never;

    await restApi.addService(scope, {
      serviceId: "imap-email",
      serviceName: "IMAP Email",
    } as never);
    await restApi.configureService(scope, { uuid: "imap-1" } as never, {
      password: "{{secret.gmail.imap}}",
    });

    expect(sentTo(fetchMock, "/secrets")).toEqual({
      "gmail.imap": { value: "hunter2" },
    });
  });

  it("says nothing when the configuration names no secret", async () => {
    // Including for a service that holds one: what it holds was sent when it
    // was configured, and the runtime keeps it.
    setSecretStore(storeOf({ "gmail.imap": "hunter2" }));
    const fetchMock = mockFetch(() => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }));

    const scope = {
      descriptor: runtime,
      services: withSecret,
      authenticatedUser: null,
    } as never;

    await restApi.configureService(scope, { uuid: "imap-1" } as never, {
      connect: true,
    });

    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes("/secrets")),
    ).toHaveLength(0);
  });
});

/**
 * The gate in front of every one of those moments.
 *
 * A board chooses the services, the secrets they name and the server they run
 * on, and a board is not necessarily one you wrote. Consent is asked for once
 * per board, runtime and address; what it withholds never reaches the wire.
 */
describe("consent before the values leave", () => {
  const provision = async (fetchMock: ReturnType<typeof mockFetch>) => {
    await restApi.restoreRuntime(runtime, withSecret, null, "Board");
    return sentTo(fetchMock, "/runtimes");
  };

  const okRuntime = () => ({
    ok: true,
    status: 200,
    json: async () => ({
      runtimes: [{ id: "node", name: "Node", services: [], outputUrl: "" }],
      registry: [],
    }),
  });

  const grants = () => {
    const held: Record<string, string[]> = {};
    return {
      granted: (key: string) => held[key] ?? [],
      grant: (key: string, aliases: string[]) => {
        held[key] = [...new Set([...(held[key] ?? []), ...aliases])];
      },
    };
  };

  afterEach(() => resetSecretConsent());

  it("names the board, the runtime and the address it is asking about", async () => {
    setSecretStore(storeOf({ "gmail.imap": "hunter2" }));
    const asked: SecretRelease[] = [];
    setSecretConsent({
      grants: grants(),
      prompt: async (request) => {
        asked.push(request);
        return { allowed: request.aliases, remember: false };
      },
    });
    await provision(mockFetch(okRuntime));

    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({
      boardName: "Board",
      runtimeId: "node",
      url: "http://127.0.0.1:8080",
      aliases: ["gmail.imap"],
    });
  });

  it("provisions with no secrets at all when it is refused", async () => {
    setSecretStore(storeOf({ "gmail.imap": "hunter2" }));
    setSecretConsent({
      grants: grants(),
      prompt: async () => ({ allowed: [], remember: false }),
    });
    const fetchMock = mockFetch(okRuntime);

    expect((await provision(fetchMock)).secrets).toEqual({});
  });

  it("does not ask about an alias the vault does not hold", async () => {
    setSecretStore(storeOf({}));
    const prompt = vi.fn(async () => ({ allowed: [], remember: false }));
    setSecretConsent({ grants: grants(), prompt });
    await provision(mockFetch(okRuntime));

    expect(prompt).not.toHaveBeenCalled();
  });

  it("gates the push that goes with a configuration too", async () => {
    setSecretStore(storeOf({ "gmail.imap": "hunter2" }));
    setSecretConsent({
      grants: grants(),
      prompt: async () => ({ allowed: [], remember: false }),
    });
    const fetchMock = mockFetch(okRuntime);

    const { scope } = (await restApi.restoreRuntime(
      runtime,
      [],
      null,
      "Board",
    ))!;
    fetchMock.mockClear();
    await restApi.configureService(scope, { uuid: "imap-1" } as any, {
      password: "{{secret.gmail.imap}}",
    });

    expect(sentTo(fetchMock, "/secrets")).toBeUndefined();
  });

  it("carries the audience with the value, so the runtime holds the same constraint", async () => {
    setSecretStore({
      ...storeOf({ "gmail.imap": "hunter2" }),
      audience: () => ["imap.gmail.com"],
    });
    setSecretConsent({
      grants: grants(),
      prompt: async (request) => ({ allowed: request.aliases, remember: false }),
    });
    const fetchMock = mockFetch(okRuntime);

    expect((await provision(fetchMock)).secrets).toEqual({
      "gmail.imap": { value: "hunter2", audience: ["imap.gmail.com"] },
    });
  });
});
