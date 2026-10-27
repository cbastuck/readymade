import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { SecretsHost } from "hkp-frontend/src/views/secrets/secretsModel";

/**
 * Secrets on a phone.
 *
 * The page is the desktop settings tab's model laid out for touch, so what is
 * held here is the same contract: a value goes in and never comes back out, an
 * audience is shown and edited on its own, and a remembered grant can be
 * forgotten. The host is the shell's store (the Keychain, the Keystore), which
 * these tests stand in for with a map.
 */

const GRANT_KEY = JSON.stringify(["Mail", "node", "http://127.0.0.1:8080"]);

/** A shell's store: values that are never handed back, audiences that are. */
function fakeHost(initial: Record<string, { value: string; audience: string[] }> = {}) {
  const held = new Map(Object.entries(initial));
  const host = {
    listSecrets: vi.fn(async () => [...held.keys()]),
    listSecretAudiences: vi.fn(async () =>
      Object.fromEntries([...held].map(([alias, entry]) => [alias, entry.audience])),
    ),
    setSecret: vi.fn(async (alias: string, value: string) => {
      held.set(alias, { value, audience: held.get(alias)?.audience ?? [] });
    }),
    setSecretAudience: vi.fn(async (alias: string, audience: string[]) => {
      const entry = held.get(alias);
      if (!entry) {
        throw new Error(`No secret called ${alias}`);
      }
      held.set(alias, { ...entry, audience });
    }),
    deleteSecret: vi.fn(async (alias: string) => {
      held.delete(alias);
    }),
    revokeSecretGrant: vi.fn(async () => {}),
  } satisfies SecretsHost;
  return { host, held };
}

/** The page module afresh, so the grants module reads what the host injected. */
async function loadPage(grants?: Record<string, string[]>) {
  vi.resetModules();
  (window as any).__HKP_GRANTS__ = grants;
  return (await import("hkp-frontend/src/views/secrets/MobileSecretsPage")).default;
}

async function renderPage(
  host: SecretsHost,
  grants?: Record<string, string[]>,
) {
  const MobileSecretsPage = await loadPage(grants);
  render(
    <MobileSecretsPage
      host={async () => host}
      onBack={() => {}}
      storageNote="Kept in this phone's Keychain."
    />,
  );
}

afterEach(() => {
  delete (window as any).__HKP_GRANTS__;
});

describe("the Secrets page on a phone", () => {
  it("lists each secret as a board refers to it, with where it may go", async () => {
    const { host } = fakeHost({
      "gmail.imap": { value: "pw", audience: ["imap.gmail.com"] },
      slack: { value: "xoxb", audience: [] },
    });
    await renderPage(host);

    expect(await screen.findByText("{{secret.gmail.imap}}")).toBeTruthy();
    expect(screen.getByText("imap.gmail.com")).toBeTruthy();
    expect(screen.getByText("{{secret.slack}}")).toBeTruthy();
    // An unconstrained secret says what will happen to it, rather than nothing.
    expect(screen.getByText("any host — pinned to the first one it is sent to")).toBeTruthy();
    expect(screen.queryByText("pw")).toBeNull();
    expect(screen.getByText("Kept in this phone's Keychain.")).toBeTruthy();
  });

  it("adds a secret with its audience, and refuses a name a reference cannot hold", async () => {
    const { host } = fakeHost();
    await renderPage(host);

    fireEvent.click(await screen.findByText("Add secret"));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "my secret" } });
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "pw" } });
    await act(async () => fireEvent.click(screen.getByText("Save")));

    expect(screen.getByText("Use letters, digits, dots, hyphens and underscores only.")).toBeTruthy();
    expect(host.setSecret).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "gmail.imap" } });
    expect(screen.getByText("{{secret.gmail.imap}}")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Hosts"), { target: { value: "IMAP.gmail.com" } });
    await act(async () => fireEvent.click(screen.getByText("Save")));

    expect(host.setSecret).toHaveBeenCalledWith("gmail.imap", "pw");
    expect(host.setSecretAudience).toHaveBeenCalledWith("gmail.imap", ["imap.gmail.com"]);
    await waitFor(() => expect(screen.getByText("imap.gmail.com")).toBeTruthy());
  });

  it("leaves the audience to first use when none is typed", async () => {
    const { host } = fakeHost();
    await renderPage(host);

    fireEvent.click(await screen.findByText("Add secret"));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "slack" } });
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "xoxb" } });
    await act(async () => fireEvent.click(screen.getByText("Save")));

    expect(host.setSecret).toHaveBeenCalledWith("slack", "xoxb");
    expect(host.setSecretAudience).not.toHaveBeenCalled();
  });

  it("changes an audience without touching the value, and the value without the audience", async () => {
    const { host, held } = fakeHost({ slack: { value: "xoxb", audience: [] } });
    await renderPage(host);

    fireEvent.click(await screen.findByText("{{secret.slack}}"));
    fireEvent.change(screen.getByLabelText("Hosts"), { target: { value: "hooks.slack.com" } });
    await act(async () => fireEvent.click(screen.getByText("Save")));

    expect(host.setSecretAudience).toHaveBeenCalledWith("slack", ["hooks.slack.com"]);
    expect(host.setSecret).not.toHaveBeenCalled();
    expect(held.get("slack")).toEqual({ value: "xoxb", audience: ["hooks.slack.com"] });

    fireEvent.click(await screen.findByText("{{secret.slack}}"));
    // The field is for putting a value in: it opens empty, never showing one.
    expect((screen.getByLabelText("New value") as HTMLInputElement).value).toBe("");
    fireEvent.change(screen.getByLabelText("New value"), { target: { value: "xoxb-2" } });
    await act(async () => fireEvent.click(screen.getByText("Save")));

    expect(host.setSecret).toHaveBeenCalledWith("slack", "xoxb-2");
    expect(host.setSecretAudience).toHaveBeenCalledTimes(1);
  });

  it("removes a secret only on a second tap", async () => {
    const { host } = fakeHost({ slack: { value: "xoxb", audience: [] } });
    await renderPage(host);

    fireEvent.click(await screen.findByText("{{secret.slack}}"));
    fireEvent.click(screen.getByText("Remove"));
    expect(host.deleteSecret).not.toHaveBeenCalled();

    await act(async () => fireEvent.click(screen.getByText("Tap again to remove")));
    expect(host.deleteSecret).toHaveBeenCalledWith("slack");
    await waitFor(() => expect(screen.getByText("Nothing stored yet.")).toBeTruthy());
  });

  it("says why the store refused", async () => {
    const { host } = fakeHost();
    host.setSecret.mockRejectedValueOnce(new Error("The Keychain refused the secret"));
    await renderPage(host);

    fireEvent.click(await screen.findByText("Add secret"));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "slack" } });
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "xoxb" } });
    await act(async () => fireEvent.click(screen.getByText("Save")));

    expect(screen.getByText("The Keychain refused the secret")).toBeTruthy();
  });

  it("lists the runtimes allowed without asking, and forgets one", async () => {
    const { host } = fakeHost();
    await renderPage(host, { [GRANT_KEY]: ["gmail.imap"] });

    expect(await screen.findByText("Mail")).toBeTruthy();
    expect(screen.getByText("http://127.0.0.1:8080 · gmail.imap")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByLabelText("Forget Mail")));
    expect(host.revokeSecretGrant).toHaveBeenCalledWith(GRANT_KEY);
  });

  it("says so on a shell with no store", async () => {
    await renderPage({});
    expect(await screen.findByText("This version of the app cannot store secrets.")).toBeTruthy();
  });
});
