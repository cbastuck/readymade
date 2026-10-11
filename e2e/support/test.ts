import {
  test as base,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";

import { installFakeNativeHost, type FakeHostConfig } from "./fakeNativeHost";
import { redact, safeUrl } from "./diagnostics";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * The host the webapp is running as. Every spec runs against all three unless
 * it opts out — the same bundle, told a different story about its surroundings.
 *
 *  - `web`     the signed-out playground on readymadeit.com; no platform host
 *  - `desktop` Readymade in the saucer webview
 *  - `mobile`  Readymade on iOS/Android, which mounts a different shell
 */
export type Profile = "web" | "desktop" | "mobile";

/** Set per project in playwright.config.ts; see its `projects`. */
export type HostOptions = {
  profile: Profile;
  /** Extra configuration for the fake native host; ignored on `web`. */
  hostConfig: Partial<FakeHostConfig>;
  /** Additional disposable servers the browser may actually contact. */
  serverOrigins: string[];
  /** Exact reviewed message patterns for intentional console errors. */
  expectedConsoleErrors: string[];
};

type HostFixtures = {
  /** Puts a board in the host's library before the app boots. */
  seedBoard: (name: string, descriptor: unknown) => Promise<void>;
  /** Gets the board open, however this shell reaches one. */
  openBoard: (name: string) => Promise<void>;
  /** What the fake native host has been asked to store. Empty on `web`. */
  hostState: () => Promise<Record<string, unknown>>;
  _diagnostics: void;
};

export const test = base.extend<HostOptions & HostFixtures>({
  profile: ["web", { option: true }],
  hostConfig: [{}, { option: true }],
  serverOrigins: [[], { option: true }],
  expectedConsoleErrors: [[], { option: true }],

  _diagnostics: [async ({ context, expectedConsoleErrors }, use, testInfo) => {
    const events: Array<{ kind: string; message: string }> = [];
    const crashes: string[] = [];
    const consoleFailures: string[] = [];
    const expected = expectedConsoleErrors.map((pattern) => new RegExp(pattern));
    let omitted = 0;
    const record = (kind: string, message: string) => {
      if (events.length < 200) events.push({ kind, message: redact(message) });
      else omitted++;
    };
    const watch = (page: Page) => {
      page.on("pageerror", (error) => {
        crashes.push(redact(String(error)));
        record("pageerror", String(error));
      });
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        record("console", message.text());
        // Browser-generated resource messages are recorded with the matching
        // HTTP/request-failure URL instead. API negative cases intentionally
        // produce these statuses; application console errors need a reviewed
        // per-spec pattern and are never ignored merely for mentioning fetch.
        const annotated = testInfo.annotations.filter((entry) => entry.type === "expected-console-error")
          .some((entry) => new RegExp(entry.description!).test(message.text()));
        if (!/^Failed to load resource:/.test(message.text()) && !expected.some((pattern) => pattern.test(message.text())) && !annotated) {
          consoleFailures.push(redact(message.text()));
        }
      });
      page.on("requestfailed", (request) => record("requestfailed",
        `${request.method()} ${safeUrl(request.url())}: ${request.failure()?.errorText ?? "unknown failure"}`,
      ));
      page.on("response", (response) => {
        if (response.status() >= 400) record("http", `${response.status()} ${safeUrl(response.url())}`);
      });
    };
    context.pages().forEach(watch);
    context.on("page", watch);
    await use();
    if (events.length) {
      const file = testInfo.outputPath("browser-diagnostics.json");
      await writeFile(file, JSON.stringify({ events, omitted }, null, 2));
      await testInfo.attach("browser-diagnostics", { path: file, contentType: "application/json" });
    }
    // Preserve an assertion's original failure; don't replace it with teardown
    // noise. Successful product journeys may not hide uncaught exceptions.
    if (crashes.length || consoleFailures.length || testInfo.status !== testInfo.expectedStatus) {
      const directory = path.join(testInfo.project.outputDir, "servers");
      for (const file of await readdir(directory).catch(() => [] as string[])) {
        await testInfo.attach(`runtime-${file}`, {
          body: redact(await readFile(path.join(directory, file), "utf8")),
          contentType: "text/plain",
        });
      }
    }
    if (testInfo.status === "passed") {
      expect(crashes, "uncaught browser exceptions (see browser-diagnostics)").toEqual([]);
      expect(consoleFailures, "unexpected application console errors (see browser-diagnostics)").toEqual([]);
    }
    context.off("page", watch);
  }, { auto: true }],

  // Installed on the context so it covers every page it opens. Init-script
  // ordering is unspecified; seedBoard queues native seeds when necessary.
  context: async ({ context, profile, hostConfig, baseURL, serverOrigins }, use) => {
    const allowed = new Set([baseURL, ...serverOrigins].filter(Boolean).map((url) => new URL(url!).origin));
    const permitted = (value: string) => {
      const url = new URL(value);
      if (url.protocol === "ws:") url.protocol = "http:";
      if (url.protocol === "wss:") url.protocol = "https:";
      return allowed.has(url.origin);
    };
    // Per-page fixture routes (e.g. ntfy) take precedence over this guard.
    // Browser traffic can reach only this suite's local servers; an unmocked
    // dependency gets an immediate deterministic response instead of a hang.
    await context.route(/^https?:\/\//, async (route) => {
      if (permitted(route.request().url())) return route.continue();
      await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"External dependency is not mocked in this E2E test"}' });
    });
    // Leave allowed sockets untouched to preserve their transport behavior.
    await context.routeWebSocket((url) => !permitted(url.toString()), (socket) => {
      socket.close({ code: 1008, reason: "External dependency is not mocked" });
    });
    if (profile !== "web") {
      await context.addInitScript(installFakeNativeHost, {
        shell: profile === "mobile" ? "ios" : "desktop",
        ...hostConfig,
      } as FakeHostConfig);
    }
    await use(context);
  },

  seedBoard: async ({ context, profile }, use) => {
    await use(async (name: string, descriptor: unknown) => {
      // A board has to be put where the shell about to look for it will look:
      // the web and mobile shells read a local library out of localStorage,
      // the desktop shell asks the platform host. Seeding both keeps the specs
      // free of that distinction. A separate marker survives deletion too:
      // reloading must never resurrect a board the test has removed.
      await context.addInitScript(
        ([boardName, item, board, native]: [string, string, unknown, boolean]) => {
          if (!/^https?:$/.test(location.protocol) || window !== window.top) return;
          const marker = `__hkp_e2e_seeded__${boardName}`;
          if (window.localStorage.getItem(marker)) return;
          window.localStorage.setItem(marker, "true");
          window.localStorage.setItem(`hkp-playground-${boardName}`, item);
          const host = (
            window as unknown as Record<
              string,
              { boards: Record<string, unknown>; modified: Record<string, string> }
            >
          ).__HKP_FAKE_HOST__;
          if (host) {
            host.boards[boardName] = board;
            host.modified[boardName] = new Date().toISOString();
          } else if (native) {
            const key = "__hkp_e2e_native_seeds__";
            const seeds = JSON.parse(window.localStorage.getItem(key) ?? "{}");
            seeds[boardName] = board;
            window.localStorage.setItem(key, JSON.stringify(seeds));
          }
        },
        [
          name,
          JSON.stringify({
            source: JSON.stringify(descriptor),
            description: (descriptor as { description?: string })?.description,
            createdAt: new Date().toISOString(),
          }),
          descriptor,
          profile !== "web",
        ] as [string, string, unknown, boolean],
      );
    });
  },

  openBoard: async ({ page, profile }, use) => {
    await use(async (name: string) => {
      // Only the web app routes to a board. Both Readymade shells boot to a
      // start page and a board is opened by picking it there — so on those the
      // journey is the entry point, and it is worth going through rather than
      // around: it is what reads the board back out of the platform host.
      if (profile === "web") {
        await page.goto(`/playground/${encodeURIComponent(name)}`);
        return;
      }
      await page.goto("/");
      // The mobile shell is driven by touch, so drive it by touch: tapping
      // goes through the browser's real gesture pipeline, where a synthetic
      // click would skip the handlers the shell actually listens on.
      const press = async (target: Locator) =>
        profile === "mobile" ? target.tap() : target.click();

      // Both shells browse the same folders-as-tags tree — source, folder,
      // board — and open the board from its details.
      await press(page.getByText("My Boards", { exact: false }).first());
      await press(page.getByText("All Boards", { exact: false }).first());
      await press(page.getByText(name, { exact: false }).first());
      await press(page.getByRole("button", { name: "Open board" }));

      if (profile === "mobile") {
        // The mobile shell opens a board as a collapsed list of services —
        // there is no room for a pipeline of panels on a phone. Expanding them
        // is what puts the same service UIs on screen the other shells render
        // directly, so specs can then say the same thing about all three.
        await press(page.getByRole("button", { name: "Show full service UIs" }));
      }
    });
  },

  hostState: async ({ page, profile }, use) => {
    await use(async () => {
      if (profile === "web") {
        return {};
      }
      return page.evaluate(
        () =>
          (window as unknown as Record<string, Record<string, unknown>>)
            .__HKP_FAKE_HOST__,
      );
    });
  },
});

export { expect };

/** The frame a service renders into; its uuid comes from the board JSON. */
export const service = (page: Page, uuid: string) =>
  page.locator(`#service-frame-${uuid}`);
