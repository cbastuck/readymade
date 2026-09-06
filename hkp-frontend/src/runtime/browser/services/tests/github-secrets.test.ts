import { afterEach, describe, expect, it, vi } from "vitest";

import { SecretStore, setSecretStore } from "hkp-frontend/src/core/secrets";

import { createBlob, getUser } from "../GithubAPI";

/**
 * The GitHub token, resolved where the request is made.
 *
 * Every call in `GithubAPI` authenticates the same way against the same host,
 * so one place turns a `{{secret.<alias>}}` token into a credential. Nothing
 * upstream of it holds a value: the service keeps the reference, the panel
 * shows the reference, and a board saved from either carries no token.
 */

function storeOf(
  entries: Record<string, { value: string; audience?: string[] }>,
): SecretStore {
  return {
    get: (alias) => entries[alias]?.value ?? null,
    audience: (alias) => entries[alias]?.audience ?? null,
    list: () => Object.keys(entries),
  };
}

/** Records every request made, and answers each one successfully. */
function captureRequests() {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: any) => {
      calls.push({ url: String(url), headers: init?.headers ?? {} });
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  setSecretStore(null);
});

describe("authenticating a request", () => {
  it("sends the value behind the reference, never the reference", async () => {
    setSecretStore(storeOf({ gh: { value: "ghp_realtoken" } }));
    const calls = captureRequests();

    await getUser("{{secret.gh}}");

    expect(calls[0].headers.Authorization).toBe("token ghp_realtoken");
  });

  it("sends a token written out unchanged, as an older board holds one", async () => {
    setSecretStore(storeOf({}));
    const calls = captureRequests();

    await getUser("ghp_written_out");

    expect(calls[0].headers.Authorization).toBe("token ghp_written_out");
  });

  it("resolves on the write paths too, not only the read ones", async () => {
    setSecretStore(storeOf({ gh: { value: "ghp_realtoken" } }));
    const calls = captureRequests();

    await createBlob("{{secret.gh}}", "owner", "repo", "content");

    expect(calls[0].headers.Authorization).toBe("token ghp_realtoken");
  });

  it("makes no request at all when the token cannot be resolved", async () => {
    setSecretStore(storeOf({}));
    const calls = captureRequests();

    await expect(getUser("{{secret.absent}}")).rejects.toThrow(
      "GitHub: no value stored for absent",
    );
    // Failing before the wire rather than after: an unresolved reference sent
    // as a credential is a 401 somewhere far away that names nothing.
    expect(calls).toHaveLength(0);
  });

  it("refuses a token bound to somewhere other than GitHub", async () => {
    // The leak this closes: a board choosing the credential must not be able to
    // choose the destination too.
    setSecretStore(
      storeOf({ gh: { value: "ghp_realtoken", audience: ["evil.example"] } }),
    );
    const calls = captureRequests();

    await expect(getUser("{{secret.gh}}")).rejects.toThrow(
      "gh may not be sent to api.github.com",
    );
    expect(calls).toHaveLength(0);
  });

  it("accepts a token bound to GitHub", async () => {
    setSecretStore(
      storeOf({ gh: { value: "ghp_realtoken", audience: ["api.github.com"] } }),
    );
    const calls = captureRequests();

    await getUser("{{secret.gh}}");

    expect(calls[0].headers.Authorization).toBe("token ghp_realtoken");
  });
});
