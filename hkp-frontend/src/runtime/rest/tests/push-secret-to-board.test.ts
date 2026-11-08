import { afterEach, describe, expect, it, vi } from "vitest";

import { setSecretStore } from "hkp-frontend/src/core/secrets";
import {
  SecretRelease,
  resetSecretConsent,
  setSecretConsent,
} from "hkp-frontend/src/core/secretConsent";
import { sessionSecrets } from "hkp-frontend/src/secretsBackend";
import { vaultDelete, vaultSecretStore } from "hkp-frontend/src/vault";
import { BoardDescriptor, RuntimeDescriptor, RuntimeScope } from "hkp-frontend/src/types";

import { pushSecretToBoard } from "../pushSecretToBoard";
import RuntimeRestScope from "../RuntimeRestScope";

/**
 * A secret stored while a board runs reaches the runtimes that name it.
 *
 * Where secrets live in the page's memory, reopening the board is not a way to
 * get one there: a reload forgets the value it was meant to carry. So storing
 * one hands it on at once — to exactly the remote runtimes whose services
 * refer to it, and with nothing else, so the consent prompt asks about that.
 */

function runtime(id: string, type = "rest"): RuntimeDescriptor {
  return { id, name: id, type, url: `http://127.0.0.1:8080` } as RuntimeDescriptor;
}

function boardOf(
  runtimes: RuntimeDescriptor[],
  services: BoardDescriptor["services"],
) {
  const scopes: { [id: string]: RuntimeScope } = {};
  for (const rt of runtimes) {
    scopes[rt.id] =
      rt.type === "rest"
        ? Object.assign(new RuntimeRestScope(rt, ""), { boardName: "Radio" })
        : ({ descriptor: rt } as unknown as RuntimeScope);
  }
  return {
    runtimes,
    scopes,
    serializeBoard: async () => ({ runtimes, services }) as unknown as BoardDescriptor,
  };
}

function mockFetch() {
  const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(async () => {
  vi.unstubAllGlobals();
  setSecretStore(null);
  resetSecretConsent();
  for (const alias of (await sessionSecrets.listSecrets!())) {
    vaultDelete(alias);
  }
});

describe("pushSecretToBoard", () => {
  it("sends a stored secret to the remote runtime that names it, and to nothing else", async () => {
    setSecretStore(vaultSecretStore);
    await sessionSecrets.setSecret!("anthropic.key", "sk-test");
    await sessionSecrets.setSecret!("other", "unrelated");
    const fetchMock = mockFetch();

    const board = boardOf([runtime("ui", "browser"), runtime("editor"), runtime("voice")], {
      ui: [{ uuid: "a", serviceId: "timer", serviceName: "Timer", state: {} }],
      editor: [
        {
          uuid: "brief",
          serviceId: "text-generation",
          serviceName: "Brief",
          state: { apiKey: "{{secret.anthropic.key}}", other: "{{secret.other}}" },
        },
      ],
      voice: [{ uuid: "speech", serviceId: "speech", serviceName: "Speech", state: {} }],
    } as BoardDescriptor["services"]);

    await pushSecretToBoard(board, "anthropic.key");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    expect(url).toBe("http://127.0.0.1:8080/runtimes/editor/secrets");
    expect(JSON.parse(init.body)).toEqual({ "anthropic.key": { value: "sk-test" } });
  });

  it("finds a reference held in a block use's params", async () => {
    setSecretStore(vaultSecretStore);
    await sessionSecrets.setSecret!("anthropic.key", "sk-test");
    const fetchMock = mockFetch();

    const board = boardOf([runtime("editor")], {
      editor: [{ block: "brief", params: { apiKey: "{{secret.anthropic.key}}" } }],
    } as unknown as BoardDescriptor["services"]);

    await pushSecretToBoard(board, "anthropic.key");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks before handing it over, and sends nothing when refused", async () => {
    setSecretStore(vaultSecretStore);
    await sessionSecrets.setSecret!("anthropic.key", "sk-test");
    const asked: SecretRelease[] = [];
    setSecretConsent({
      prompt: async (request) => {
        asked.push(request);
        return { allowed: [], remember: false };
      },
    });
    const fetchMock = mockFetch();

    const board = boardOf([runtime("editor")], {
      editor: [
        { uuid: "brief", serviceId: "text-generation", serviceName: "Brief", state: { apiKey: "{{secret.anthropic.key}}" } },
      ],
    } as BoardDescriptor["services"]);

    await pushSecretToBoard(board, "anthropic.key");

    expect(asked.map((r) => [r.boardName, r.runtimeId, r.aliases])).toEqual([
      ["Radio", "editor", ["anthropic.key"]],
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing without an open board", async () => {
    const fetchMock = mockFetch();
    await pushSecretToBoard(null, "anthropic.key");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("sessionSecrets", () => {
  it("holds what is set for this page and resolves it for boards", async () => {
    setSecretStore(vaultSecretStore);
    await sessionSecrets.setSecret!("anthropic.key", "sk-test");
    await sessionSecrets.setSecretAudience!("anthropic.key", ["api.anthropic.com"]);

    expect(await sessionSecrets.listSecrets!()).toEqual(["anthropic.key"]);
    expect(await sessionSecrets.listSecretAudiences!()).toEqual({
      "anthropic.key": ["api.anthropic.com"],
    });
    expect(vaultSecretStore.get("anthropic.key")).toBe("sk-test");

    await sessionSecrets.deleteSecret!("anthropic.key");
    expect(vaultSecretStore.get("anthropic.key")).toBeNull();
  });

  it("writes nothing to browser storage", async () => {
    localStorage.clear();
    sessionStorage.clear();
    await sessionSecrets.setSecret!("anthropic.key", "sk-test");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
