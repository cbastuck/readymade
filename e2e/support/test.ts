import {
  test as base,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";

import { installFakeNativeHost, type FakeHostConfig } from "./fakeNativeHost";

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
};

type HostFixtures = {
  /** Puts a board in the host's library before the app boots. */
  seedBoard: (name: string, descriptor: unknown) => Promise<void>;
  /** Gets the board open, however this shell reaches one. */
  openBoard: (name: string) => Promise<void>;
  /** What the fake native host has been asked to store. Empty on `web`. */
  hostState: () => Promise<Record<string, unknown>>;
};

export const test = base.extend<HostOptions & HostFixtures>({
  profile: ["web", { option: true }],
  hostConfig: [{}, { option: true }],

  // Installed on the context so it covers every page it opens — which is what
  // the multi-page (two-user, peer) specs will need. Init scripts accumulate,
  // so per-test seeding can add to this later.
  context: async ({ context, profile, hostConfig }, use) => {
    if (profile !== "web") {
      await context.addInitScript(installFakeNativeHost, {
        shell: profile === "mobile" ? "ios" : "desktop",
        ...hostConfig,
      } as FakeHostConfig);
    }
    await use(context);
  },

  seedBoard: async ({ context }, use) => {
    await use(async (name: string, descriptor: unknown) => {
      // A board has to be put where the shell about to look for it will look:
      // the web and mobile shells read a local library out of localStorage,
      // the desktop shell asks the platform host. Seeding both keeps the specs
      // free of that distinction — the init scripts run in the order they were
      // added, so the fake host is already installed by the time this lands.
      await context.addInitScript(
        ([boardName, item, board]: [string, string, unknown]) => {
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
        ] as [string, string, unknown],
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
