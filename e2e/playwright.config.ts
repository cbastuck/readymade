import { defineConfig, devices } from "@playwright/test";

import type { HostOptions } from "./support/test";

/**
 * One suite, three host profiles.
 *
 * The same webapp ships to all of them; what differs is the shell it mounts
 * and the platform surface underneath it. Each profile is a project, so a spec
 * is written once and told which host it is on through the `profile` option —
 * see support/test.ts.
 *
 *  - `web`     hkp-frontend's own app, signed out, no platform host at all
 *  - `desktop` the meander bundle with a fake saucer host behind it
 *  - `mobile`  the same bundle, mounting MobileApp, on a touch device
 */

const FRONTEND_PORT = 5199;
const MEANDER_PORT = 8599;

/**
 * Chrome answers ICE with `.local` mDNS names instead of host candidates,
 * which two isolated contexts cannot resolve for each other — so any peer
 * board would hang rather than connect. See tests/capabilities/webrtc.spec.ts,
 * which fails loudly if this stops being enough.
 */
const CHROMIUM_ARGS = ["--disable-features=WebRtcHideLocalIpsWithMdns"];

export default defineConfig<HostOptions>({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html"]] : [["list"], ["html"]],

  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "web",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { args: CHROMIUM_ARGS },
        baseURL: `http://localhost:${FRONTEND_PORT}`,
        profile: "web",
      },
    },
    {
      name: "desktop",
      // The capability checks launch their own browsers, and the sweep asks
      // about board JSON rather than about a host — both answer the same
      // whichever project runs them, so one project runs them.
      testIgnore: /(capabilities|smoke)\//,
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { args: CHROMIUM_ARGS },
        baseURL: `http://localhost:${MEANDER_PORT}`,
        profile: "desktop",
      },
    },
    {
      name: "mobile",
      testIgnore: /(capabilities|smoke)\//,
      use: {
        // A real touch device, not just a narrow window: the mobile shell has
        // its own gesture code (MobileHub, MobileSubPipeline, ServiceSheet),
        // and synthetic touch events would not exercise it.
        ...devices["iPhone 13"],
        baseURL: `http://localhost:${MEANDER_PORT}`,
        profile: "mobile",
      },
    },
  ],

  webServer: [
    {
      command: `npx vite --port ${FRONTEND_PORT} --strictPort`,
      // vite serves its working directory, so each server has to be started
      // from its own app rather than from here.
      cwd: "../hkp-frontend",
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npx vite --port ${MEANDER_PORT} --strictPort`,
      cwd: "../meander/frontend",
      url: `http://localhost:${MEANDER_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
