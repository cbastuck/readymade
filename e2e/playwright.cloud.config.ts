import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
 * A fourth joins where it has been built: hkp-rt, the C++ runtime server, as a
 * second place a board's runtime can live. `hkp-rt/run-tests.sh` builds the
 * binary; without it the specs that need it are skipped.
 *
 * One host profile, the desktop shell: it is the one whose session and remotes
 * a spec can supply (through the fake native host), and what is under test
 * here is deploying, not the shells.
 */

const MEANDER_PORT = 8599;
export const NODE_PORT = 18080;
export const NODE_URL = `http://127.0.0.1:${NODE_PORT}`;
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const RT_PORT = 18087;
export const RT_URL = `http://127.0.0.1:${RT_PORT}`;
/** The hkp-rt binary, when one has been built; `HKP_RT_BIN` names another. */
export const RT_BIN = [
  process.env.HKP_RT_BIN,
  path.resolve(HERE, "../hkp-rt/build-tests/exe/hkp-rt"),
  path.resolve(HERE, "../hkp-rt/build/exe/hkp-rt"),
].find((candidate) => !!candidate && fs.existsSync(candidate));

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
      // Keep child servers on the same Node as Playwright. `npx` resolves
      // `node` through PATH and can otherwise fall back to an older system
      // runtime even when this suite was explicitly started with Node 22.
      command: `"${process.execPath}" node_modules/vite/bin/vite.js --port ${MEANDER_PORT} --strictPort`,
      cwd: "../meander/frontend",
      url: `http://localhost:${MEANDER_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `"${process.execPath}" node_modules/tsx/dist/cli.mjs src/index.ts`,
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
    ...(RT_BIN
      ? [
          {
            command: `"${RT_BIN}" ${RT_PORT}`,
            url: `${RT_URL}/runtimes`,
            reuseExistingServer: false,
            timeout: 60_000,
            env: {
              HOST: "",
              AUTH0_DOMAIN: "",
              AUTH0_AUDIENCE: "",
              ALLOWED_EMAILS: "",
              HKP_COORDINATOR_LINKS_FILE: "",
              HKP_MOUNT_SECRET: "e2e",
              HKP_EXTERNAL_URL: "",
            },
          },
        ]
      : []),
  ],
});
