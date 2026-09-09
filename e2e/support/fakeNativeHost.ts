/**
 * A stand-in for the native host the webapp runs inside.
 *
 * The Readymade shells expose their platform through two surfaces, and this
 * fake implements both:
 *
 *  - `window.saucer.exposed.*` — direct calls into the desktop webview
 *    (file dialogs, the secret store). Its presence is also what
 *    `MeanderPlatformProvider` reads to decide it is running natively.
 *  - `fetch("hkp://…")` — a custom scheme registered by the webview, which
 *    `meanderBackend` uses for boards, remotes, settings, history and the
 *    start-page tree.
 *
 * Both are installed as a page init script, because the app decides what host
 * it is on while its modules evaluate: `isMeanderApp()` memoises a single
 * `hkp://boards/` probe, and `MeanderPlatformProvider` reads `saucer.exposed`
 * at module scope. Anything installed after the first navigation is too late
 * and yields a confusing half-native app.
 *
 * `page.route` cannot serve any of this: `hkp://` is not http, so it never
 * reaches Playwright's proxy. Wrapping `window.fetch` is the only way in.
 *
 * Everything the host is asked to store stays in memory and is mirrored on
 * `window.__HKP_FAKE_HOST__`, so a test can assert on what the app actually
 * handed the platform rather than only on what the UI shows.
 */

/** Which shell the webapp should boot into. */
export type HostShell = "desktop" | "ios" | "android";

export type FakeHostConfig = {
  shell: HostShell;
  /** Boards the host's library already holds, by name. */
  boards?: Record<string, unknown>;
  /** Runtime-access settings the host reports. */
  settings?: { allowExternalRuntimeAccess: boolean; allowedUsers: string[] };
  /** Secret aliases the host's vault already holds, by alias. */
  secrets?: Record<string, string>;
  /** Files the host can read, by path — what `pickFile` hands back. */
  files?: Record<string, string>;
  /** What the platform's file chooser returns; null means the user cancelled. */
  pickedPath?: string | null;
};

/**
 * Runs inside the page, before any application module evaluates.
 *
 * Written as one self-contained function because Playwright serialises it: it
 * cannot reference anything from this module's scope, so all of its input
 * arrives through `config`.
 */
export function installFakeNativeHost(config: FakeHostConfig): void {
  const store = {
    shell: config.shell,
    boards: { ...(config.boards ?? {}) } as Record<string, unknown>,
    /** Board name -> ISO timestamp, as the host reports for `?meta=1`. */
    modified: {} as Record<string, string>,
    remotes: [] as unknown[],
    settings: config.settings ?? {
      allowExternalRuntimeAccess: false,
      allowedUsers: [] as string[],
    },
    startpage: null as unknown,
    history: {} as Record<string, unknown[]>,
    boardArt: {} as Record<string, string>,
    secrets: { ...(config.secrets ?? {}) } as Record<string, string>,
    audiences: {} as Record<string, string[]>,
    grants: {} as Record<string, string[]>,
    files: { ...(config.files ?? {}) } as Record<string, string>,
    /** Every write the app made, in order — the platform-seam assertion target. */
    calls: [] as Array<{ method: string; url: string; body?: unknown }>,
    /** Owner emails pushed to the embedded runtime (the iOS auth bridge). */
    runtimeAllowedUsers: [] as Array<string | null>,
  };
  (window as unknown as Record<string, unknown>).__HKP_FAKE_HOST__ = store;

  for (const name of Object.keys(store.boards)) {
    store.modified[name] = new Date().toISOString();
  }

  // Which shell `main.tsx` mounts. Desktop is the absence of both flags.
  if (config.shell === "ios") {
    (window as unknown as Record<string, unknown>).__MEANDER_IOS__ = true;
  } else if (config.shell === "android") {
    (window as unknown as Record<string, unknown>).__MEANDER_ANDROID__ = true;
  }

  // The iOS bridge that tells the embedded runtime who may drive it.
  (window as unknown as Record<string, unknown>).hkpRuntimeAuth = {
    postMessage: (payload: { email: string | null }) => {
      store.runtimeAllowedUsers.push(payload?.email ?? null);
    },
  };

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  const empty = (status = 200) => new Response(null, { status });
  const notFound = () => new Response("not found", { status: 404 });

  const readBody = async (init?: RequestInit): Promise<unknown> => {
    if (!init || init.body == null) {
      return undefined;
    }
    if (typeof init.body === "string") {
      try {
        return JSON.parse(init.body);
      } catch {
        return init.body;
      }
    }
    return init.body;
  };

  const route = async (url: string, init: RequestInit): Promise<Response> => {
    const method = (init.method ?? "GET").toUpperCase();
    const body = await readBody(init);
    if (method !== "GET") {
      store.calls.push({ method, url, body });
    }

    // Hand-parsed rather than via `new URL`: `hkp://` is a non-special scheme
    // and browsers disagree on how its authority and path split.
    const rest = url.slice("hkp://".length);
    const [pathPart, queryPart = ""] = rest.split("?");
    const segments = pathPart.split("/");
    const root = segments[0];
    const tail = decodeURIComponent(segments.slice(1).join("/"));
    const query = new URLSearchParams(queryPart);

    if (root === "boards") {
      if (!tail) {
        const names = Object.keys(store.boards);
        return json(
          query.get("meta")
            ? names.map((name) => ({
                name: encodeURIComponent(name),
                modified: store.modified[name],
              }))
            : names.map((name) => encodeURIComponent(name)),
        );
      }
      if (method === "GET") {
        return tail in store.boards ? json(store.boards[tail]) : notFound();
      }
      if (method === "POST") {
        store.boards[tail] = body;
        store.modified[tail] = new Date().toISOString();
        return empty();
      }
      if (method === "DELETE") {
        delete store.boards[tail];
        delete store.modified[tail];
        return empty();
      }
    }

    if (root === "remotes") {
      if (method === "GET") {
        return json(store.remotes);
      }
      if (method === "POST") {
        store.remotes = Array.isArray(body) ? body : store.remotes;
        return empty();
      }
    }

    if (root === "settings") {
      if (method === "GET") {
        return json(store.settings);
      }
      if (method === "POST") {
        store.settings = { ...store.settings, ...(body as object) };
        return json(store.settings);
      }
    }

    if (root === "startpage") {
      if (method === "GET") {
        return store.startpage ? json(store.startpage) : notFound();
      }
      if (method === "POST") {
        store.startpage = body;
        return empty();
      }
    }

    if (root === "history") {
      if (!tail) {
        return json(
          Object.keys(store.history).map((name) => ({
            name,
            latestTimestamp: (
              store.history[name][store.history[name].length - 1] as {
                timestamp?: string;
              }
            )?.timestamp,
          })),
        );
      }
      if (method === "GET") {
        return json(store.history[tail] ?? []);
      }
      if (method === "POST") {
        store.history[tail] = [...(store.history[tail] ?? []), body];
        return empty();
      }
      if (method === "DELETE") {
        delete store.history[tail];
        return empty();
      }
    }

    if (root === "board-art") {
      if (method === "POST") {
        store.boardArt[tail] = "stored";
        return empty();
      }
      return store.boardArt[tail] ? new Response("art") : notFound();
    }

    if (root === "mint-token") {
      return json({ token: "fake-capability-token" });
    }

    return notFound();
  };

  const realFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (!url.startsWith("hkp://")) {
      return realFetch(input as RequestInfo, init);
    }
    return route(url, init ?? {});
  }) as typeof window.fetch;

  // The desktop webview's direct calls. `pickSavePath` and `writeFile` being
  // present is itself the native check in MeanderPlatformProvider, so a fake
  // that omits them boots as a plain browser.
  (window as unknown as Record<string, unknown>).saucer = {
    exposed: {
      pickFile: async () => config.pickedPath ?? null,
      pickFolder: async () => config.pickedPath ?? null,
      pickSavePath: async () => config.pickedPath ?? null,
      readFile: async (path: string) => {
        if (!(path in store.files)) {
          throw new Error(`no such file: ${path}`);
        }
        return store.files[path];
      },
      writeFile: async (path: string, content: string) => {
        store.files[path] = content;
        store.calls.push({ method: "WRITE", url: path, body: content });
      },
      secretAliases: async () => Object.keys(store.secrets),
      setSecret: async (alias: string, value: string) => {
        store.secrets[alias] = value;
        store.calls.push({ method: "SET_SECRET", url: alias });
      },
      deleteSecret: async (alias: string) => {
        delete store.secrets[alias];
      },
      secretAudiences: async () => JSON.stringify(store.audiences),
      setSecretAudience: async (alias: string, audience: string[]) => {
        store.audiences[alias] = audience;
      },
      grantSecrets: async (key: string, aliases: string[]) => {
        store.grants[key] = aliases;
      },
      revokeSecretGrant: async (key: string) => {
        delete store.grants[key];
      },
      mintProcessRuntimeToken: async () => "fake-capability-token",
    },
  };
}
