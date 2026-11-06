import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ASSIST_TOKEN_ALIASES,
  AssistTokenStore,
  readAssistSettings,
  saveAssistSettings,
  setAssistTokenStore,
} from "./settings";

/**
 * On a host with a secret store the provider tokens are kept there, beside
 * every other credential, each allowed only to its provider's host. Browser
 * storage keeps the rest of the preferences, and no token.
 */

const KEY = "readymade.ai-assist.v1";

function fakeVault() {
  const values = new Map<string, string>();
  const audiences = new Map<string, string[]>();
  const store: AssistTokenStore = {
    read: (alias) => values.get(alias) ?? null,
    write: async (alias, value, audience) => {
      values.set(alias, value);
      audiences.set(alias, audience);
    },
    remove: async (alias) => {
      values.delete(alias);
      audiences.delete(alias);
    },
    setAudience: async (alias, audience) => {
      audiences.set(alias, audience);
    },
  };
  return { store, values, audiences };
}

const stored = () => JSON.parse(localStorage.getItem(KEY) ?? "{}");

beforeEach(() => localStorage.clear());
afterEach(() => setAssistTokenStore(null));

describe("with a host that keeps secrets", () => {
  it("writes a token to the vault, allowed only to its provider", async () => {
    const vault = fakeVault();
    setAssistTokenStore(vault.store);
    await saveAssistSettings({ anthropicToken: "sk-ant", model: "" });
    expect(vault.values.get(ASSIST_TOKEN_ALIASES.anthropicToken)).toBe("sk-ant");
    expect(vault.audiences.get(ASSIST_TOKEN_ALIASES.anthropicToken)).toEqual([
      "api.anthropic.com",
    ]);
    expect(stored()).not.toHaveProperty("anthropicToken");
    expect(readAssistSettings().anthropicToken).toBe("sk-ant");
  });

  it("lets a server's token follow the server when its address changes", async () => {
    const vault = fakeVault();
    setAssistTokenStore(vault.store);
    await saveAssistSettings({
      openAICompatibleUrl: "http://192.168.1.20:8081/v1",
      openAICompatibleToken: "local",
    });
    const alias = ASSIST_TOKEN_ALIASES.openAICompatibleToken;
    expect(vault.audiences.get(alias)).toEqual(["192.168.1.20"]);
    await saveAssistSettings({ openAICompatibleUrl: "https://llm.example.com/v1" });
    expect(vault.audiences.get(alias)).toEqual(["llm.example.com"]);
    expect(stored().openAICompatibleUrl).toBe("https://llm.example.com/v1");
  });

  it("keeps an OpenCode server password in the vault with its server audience", async () => {
    const vault = fakeVault();
    setAssistTokenStore(vault.store);
    await saveAssistSettings({
      openCodeUrl: "http://127.0.0.1:4096",
      openCodePassword: "server-password",
    });
    const alias = ASSIST_TOKEN_ALIASES.openCodePassword;
    expect(vault.values.get(alias)).toBe("server-password");
    expect(vault.audiences.get(alias)).toEqual(["127.0.0.1"]);
    expect(stored()).not.toHaveProperty("openCodePassword");
  });

  it("removes a token from the vault when it is cleared", async () => {
    const vault = fakeVault();
    setAssistTokenStore(vault.store);
    await saveAssistSettings({ anthropicToken: "sk-ant" });
    await saveAssistSettings({ anthropicToken: "", model: "" });
    expect(vault.values.has(ASSIST_TOKEN_ALIASES.anthropicToken)).toBe(false);
    expect(readAssistSettings().anthropicToken).toBe("");
  });

  it("moves tokens kept in browser storage into the vault", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ anthropicToken: "old", model: "kept", effort: "high" }),
    );
    const vault = fakeVault();
    setAssistTokenStore(vault.store);
    await Promise.resolve();
    await Promise.resolve();
    expect(vault.values.get(ASSIST_TOKEN_ALIASES.anthropicToken)).toBe("old");
    expect(stored()).toEqual({ model: "kept", effort: "high" });
    expect(readAssistSettings()).toMatchObject({ anthropicToken: "old", effort: "high" });
  });

  it("keeps the vault's token over a copy left in browser storage", async () => {
    localStorage.setItem(KEY, JSON.stringify({ anthropicToken: "stale" }));
    const vault = fakeVault();
    vault.values.set(ASSIST_TOKEN_ALIASES.anthropicToken, "current");
    setAssistTokenStore(vault.store);
    expect(readAssistSettings().anthropicToken).toBe("current");
    await Promise.resolve();
    await Promise.resolve();
    expect(vault.values.get(ASSIST_TOKEN_ALIASES.anthropicToken)).toBe("current");
    expect(stored()).not.toHaveProperty("anthropicToken");
  });

  it("says when the vault refused a token", async () => {
    const vault = fakeVault();
    setAssistTokenStore({
      ...vault.store,
      write: async () => {
        throw new Error("refused");
      },
    });
    await expect(saveAssistSettings({ anthropicToken: "sk-ant" })).rejects.toThrow(
      "refused",
    );
  });
});

describe("without one", () => {
  it("keeps tokens in browser storage, as the web always has", async () => {
    await saveAssistSettings({ anthropicToken: "sk-ant" });
    expect(stored().anthropicToken).toBe("sk-ant");
    expect(readAssistSettings().anthropicToken).toBe("sk-ant");
  });
});
