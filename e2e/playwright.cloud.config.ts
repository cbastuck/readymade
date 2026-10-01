import { defineConfig, devices } from "@playwright/test";

import type { HostOptions } from "./support/test";

/**
 * The specs that need a real runtime server and a real coordinator.
 *
 * Kept out of the main config so the fast suite stays fast and starts nothing
 * but the two dev servers. Here a third process joins them: one hkp-node on
 * loopback, serving as both runtime server and coordinator — the single-box
 * setup. On loopback it runs without authentication, and keeps nothing on
 * disk: every directory it would write to is pointed at nowhere.
 *
 * One host profile, the desktop shell: it is the one whose session and remotes
 * a spec can supply (through the fake native host), and what is under test
 * here is deploying, not the shells.
 */

const MEANDER_PORT = 8599;
export const NODE_PORT = 18080;
export const NODE_URL = `http://127.0.0.1:${NODE_PORT}`;

export default defineConfig<HostOptions>({
  testDir: "./tests/cloud",
  // One runtime server shared by every spec, with one tenant: specs use their
  // own runtime ids and board names, but there is no reason to race them.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html"]] : [["list"], ["html"]],

  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "cloud",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://localhost:${MEANDER_PORT}`,
        profile: "desktop",
      },
    },
  ],

  webServer: [
    {
      command: `npx vite --port ${MEANDER_PORT} --strictPort`,
      cwd: "../meander/frontend",
      url: `http://localhost:${MEANDER_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npx tsx src/index.ts",
      cwd: "../hkp-node",
      url: `${NODE_URL}/runtimes`,
      // Never reused: a server left over from another run would still hold
      // that run's boards and tickets.
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        SKIP_LOADING_ENV: "true",
        HOST: "127.0.0.1",
        EXTERNAL_HOST: "127.0.0.1",
        PORT: String(NODE_PORT),
        COORDINATOR_ENABLED: "true",
        AUTH0_DOMAIN: "",
        AUTH0_AUDIENCE: "",
        ALLOWED_EMAILS: "",
        HKP_MOUNT_SECRET: "e2e",
        HKP_COORDINATOR_DATA_DIR: "",
        HKP_COORDINATOR_LOG_DIR: "",
        HKP_COORDINATOR_LINKS_FILE: "",
        HKP_STORE_DIR: "",
        HKP_DB_DIR: "",
        HKP_FILES_DIR: "",
      },
    },
  ],
});
