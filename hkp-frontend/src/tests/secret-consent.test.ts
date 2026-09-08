import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ConsentDecision,
  GrantStore,
  SecretRelease,
  allowedSecrets,
  alreadyGranted,
  grantKey,
  inProcessRuntime,
  resetSecretConsent,
  setSecretConsent,
} from "hkp-frontend/src/core/secretConsent";

/** A grant store that lives for one test, so nothing carries between them. */
function memoryGrants(initial: Record<string, string[]> = {}): GrantStore {
  const held: Record<string, string[]> = { ...initial };
  return {
    granted: (key) => held[key] ?? [],
    grant: (key, aliases) => {
      held[key] = [...new Set([...(held[key] ?? []), ...aliases])];
    },
  };
}

const release = (over: Partial<SecretRelease> = {}): SecretRelease => ({
  boardName: "Mail",
  runtimeId: "node",
  url: "http://127.0.0.1:8080",
  aliases: ["gmail.imap"],
  ...over,
});

/** Answers every question the same way, and records what it was asked. */
function alwaysAnswer(decision: ConsentDecision) {
  const asked: SecretRelease[] = [];
  const prompt = vi.fn(async (request: SecretRelease) => {
    asked.push(request);
    return decision;
  });
  return { asked, prompt };
}

afterEach(() => resetSecretConsent());

describe("what a grant is keyed on", () => {
  it("separates two boards naming the same runtime", () => {
    expect(grantKey(release({ boardName: "Mail" }))).not.toBe(
      grantKey(release({ boardName: "Other" })),
    );
  });

  it("separates the same runtime id pointed at another server", () => {
    expect(grantKey(release({ url: "http://127.0.0.1:8080" }))).not.toBe(
      grantKey(release({ url: "https://evil.example" })),
    );
  });

  it("separates two servers on the same host by port", () => {
    expect(grantKey(release({ url: "http://localhost:8080" }))).not.toBe(
      grantKey(release({ url: "http://localhost:9000" })),
    );
  });

  it("ignores the path, which is not part of who is being talked to", () => {
    expect(grantKey(release({ url: "http://127.0.0.1:8080/" }))).toBe(
      grantKey(release({ url: "http://127.0.0.1:8080" })),
    );
  });
});

describe("asking", () => {
  it("releases nothing that was denied", async () => {
    const { prompt } = alwaysAnswer({ allowed: [], remember: false });
    setSecretConsent({ prompt, grants: memoryGrants() });

    expect(await allowedSecrets(release())).toEqual([]);
  });

  it("releases what was allowed", async () => {
    const { prompt } = alwaysAnswer({
      allowed: ["gmail.imap"],
      remember: false,
    });
    setSecretConsent({ prompt, grants: memoryGrants() });

    expect(await allowedSecrets(release())).toEqual(["gmail.imap"]);
  });

  it("releases the allowed part and withholds the rest", async () => {
    const { prompt } = alwaysAnswer({ allowed: ["slack"], remember: false });
    setSecretConsent({ prompt, grants: memoryGrants() });

    expect(
      await allowedSecrets(release({ aliases: ["gmail.imap", "slack"] })),
    ).toEqual(["slack"]);
  });

  it("cannot be talked into releasing something it never asked about", async () => {
    const { prompt } = alwaysAnswer({
      allowed: ["gmail.imap", "aws.root"],
      remember: true,
    });
    setSecretConsent({ prompt, grants: memoryGrants() });

    expect(await allowedSecrets(release())).toEqual(["gmail.imap"]);
  });

  it("does not ask when there is nothing to release", async () => {
    const { prompt } = alwaysAnswer({ allowed: [], remember: false });
    setSecretConsent({ prompt, grants: memoryGrants() });

    expect(await allowedSecrets(release({ aliases: [] }))).toEqual([]);
    expect(prompt).not.toHaveBeenCalled();
  });

  it("does not ask for a runtime inside this process", async () => {
    const { prompt } = alwaysAnswer({ allowed: [], remember: false });
    setSecretConsent({
      prompt,
      grants: memoryGrants(),
      isInProcess: (url) => url === "http://127.0.0.1:8080",
    });

    expect(await allowedSecrets(release())).toEqual(["gmail.imap"]);
    expect(prompt).not.toHaveBeenCalled();
  });

  it("releases everything when no host registered a way to ask", async () => {
    setSecretConsent({ grants: memoryGrants() });

    expect(await allowedSecrets(release())).toEqual(["gmail.imap"]);
  });
});

describe("remembering", () => {
  it("does not ask a second time for what was remembered", async () => {
    const { prompt } = alwaysAnswer({
      allowed: ["gmail.imap"],
      remember: true,
    });
    setSecretConsent({ prompt, grants: memoryGrants() });

    await allowedSecrets(release());
    expect(await allowedSecrets(release())).toEqual(["gmail.imap"]);
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it("asks again when the answer was not to be remembered", async () => {
    const { prompt } = alwaysAnswer({
      allowed: ["gmail.imap"],
      remember: false,
    });
    setSecretConsent({ prompt, grants: memoryGrants() });

    await allowedSecrets(release());
    await allowedSecrets(release());
    expect(prompt).toHaveBeenCalledTimes(2);
  });

  it("asks only about the secret a board added later", async () => {
    const { asked, prompt } = alwaysAnswer({
      allowed: ["slack"],
      remember: true,
    });
    setSecretConsent({
      prompt,
      grants: memoryGrants({ [grantKey(release())]: ["gmail.imap"] }),
    });

    expect(
      await allowedSecrets(release({ aliases: ["gmail.imap", "slack"] })),
    ).toEqual(["gmail.imap", "slack"]);
    expect(asked).toHaveLength(1);
    expect(asked[0].aliases).toEqual(["slack"]);
  });

  it("does not carry a grant to the same runtime id at another address", async () => {
    const { prompt } = alwaysAnswer({ allowed: [], remember: false });
    setSecretConsent({
      prompt,
      grants: memoryGrants({ [grantKey(release())]: ["gmail.imap"] }),
    });

    expect(await allowedSecrets(release({ url: "https://evil.example" }))).toEqual(
      [],
    );
    expect(prompt).toHaveBeenCalledTimes(1);
  });
});

describe("alreadyGranted", () => {
  it("is true only once every alias is covered", () => {
    setSecretConsent({
      grants: memoryGrants({ [grantKey(release())]: ["gmail.imap"] }),
    });

    expect(alreadyGranted(release())).toBe(true);
    expect(alreadyGranted(release({ aliases: ["gmail.imap", "slack"] }))).toBe(
      false,
    );
  });

  it("is true for a runtime inside this process", () => {
    setSecretConsent({
      grants: memoryGrants(),
      isInProcess: () => true,
    });

    expect(alreadyGranted(release())).toBe(true);
  });
});

/**
 * Which runtimes are asked about, and which are not.
 *
 * The host decides, because only it can tell its own embedded runtime from a
 * development server that looks identical from here. This pins the rule the app
 * registers: the two addresses that reach the runtime inside this process, and
 * nothing else.
 */
describe("the app's own embedded runtime", () => {
  const PORT = 8887;

  it("is reached through the host's own scheme", () => {
    // Everything on this scheme is served in-process, and a remote name that is
    // not the host's own is refused there rather than forwarded.
    expect(inProcessRuntime("hkp://remotes/meander-cpp", PORT)).toBe(true);
    expect(inProcessRuntime("hkp://remotes/meander-cpp/runtimes", PORT)).toBe(true);
  });

  it("is also reached on the port it binds when it is exposed", () => {
    expect(inProcessRuntime("http://127.0.0.1:8887", PORT)).toBe(true);
    expect(inProcessRuntime("http://localhost:8887/runtimes", PORT)).toBe(true);
    expect(inProcessRuntime("http://[::1]:8887", PORT)).toBe(true);
  });

  it("is not any other process on loopback", () => {
    // The case this separates: a development runtime server on the next port is
    // a separate process, and handing it a credential is a real release.
    expect(inProcessRuntime("http://127.0.0.1:8080", PORT)).toBe(false);
    expect(inProcessRuntime("http://127.0.0.1:9000", PORT)).toBe(false);
  });

  it("is only the scheme when the host binds no port", () => {
    expect(inProcessRuntime("http://127.0.0.1:8887")).toBe(false);
    expect(inProcessRuntime("hkp://remotes/meander-cpp")).toBe(true);
  });

  it("is not a remote server", () => {
    expect(inProcessRuntime("https://rest.example", PORT)).toBe(false);
    expect(inProcessRuntime("http://192.168.1.20:8887", PORT)).toBe(false);
  });

  it("is nothing at all for something that is not an address", () => {
    expect(inProcessRuntime("", PORT)).toBe(false);
    expect(inProcessRuntime("not a url", PORT)).toBe(false);
  });

  it("skips the question entirely for one", async () => {
    const { prompt } = alwaysAnswer({ allowed: [], remember: false });
    setSecretConsent({
      prompt,
      grants: memoryGrants(),
      isInProcess: (url) => inProcessRuntime(url, PORT),
    });

    const request = release({ url: "hkp://remotes/meander-cpp" });
    expect(await allowedSecrets(request)).toEqual(["gmail.imap"]);
    expect(prompt).not.toHaveBeenCalled();
  });
});
