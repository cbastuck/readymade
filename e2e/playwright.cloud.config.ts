import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

import type { HostOptions } from "./support/test";
import { reporters } from "./support/reporters";

/**
 * The specs that need a real runtime server and a real coordinator.
 *
 * Kept out of the main config so the fast suite stays fast and starts nothing
 * but the two dev servers. Here a third process joins them: one hkp-node on
 * loopback, serving as both runtime server and coordinator — the single-box
 * setup. On loopback it runs without authentication. A wrapper isolates its
 * data in a temporary directory and removes it after the child exits.
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
const cloudTarget = process.env.HKP_E2E_CLOUD_TARGET ?? "all";
if (!["node", "all"].includes(cloudTarget)) throw new Error("HKP_E2E_CLOUD_TARGET must be node or all");
for (const file of ["package.json", "node_modules/tsx/dist/cli.mjs"]) {
  if (!fs.existsSync(path.resolve(HERE, "../hkp-node", file))) {
    throw new Error(`Required Node runtime dependency missing: hkp-node/${file}. Initialize its pinned submodule and run npm ci.`);
  }
}
if (cloudTarget === "node" && process.env.HKP_E2E_REQUIRE_RT === "1") {
  throw new Error("HKP_E2E_REQUIRE_RT conflicts with the Node-only cloud target");
}
if (cloudTarget === "all" && process.env.HKP_RT_BIN && !fs.existsSync(process.env.HKP_RT_BIN)) {
  throw new Error("HKP_RT_BIN names a missing runtime binary");
}
/** C++ is optional locally; the Node CI lane explicitly excludes it. */
export const RT_BIN = cloudTarget === "node" ? undefined : [
  process.env.HKP_RT_BIN,
  path.resolve(HERE, "../hkp-rt/build-tests/exe/hkp-rt"),
  path.resolve(HERE, "../hkp-rt/build/exe/hkp-rt"),
].find((candidate) => !!candidate && fs.existsSync(candidate));
if (process.env.HKP_E2E_REQUIRE_RT === "1" && !RT_BIN) throw new Error("Required C++ runtime binary is missing");
const failureProbe = ["1", "flaky"].includes(process.env.HKP_E2E_FAILURE_PROBE ?? "0");

export default defineConfig<HostOptions>({
  testDir: "./tests/cloud",
  testMatch: failureProbe ? "**/artifact-probe.spec.ts" : "**/*.spec.ts",
  testIgnore: failureProbe ? [] : cloudTarget === "node"
    ? [/deploy-rt\.spec\.ts$/, /artifact-probe\.spec\.ts$/]
    : [/artifact-probe\.spec\.ts$/],
  // One runtime server shared by every spec, with one tenant: specs use their
  // own runtime ids and board names, but there is no reason to race them.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: !!process.env.CI,
  reporter: reporters,

  use: {
    serviceWorkers: "block",
    serverOrigins: [NODE_URL, RT_URL],
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
      command: `"${process.execPath}" ../e2e/support/runtime-server.mjs node node_modules/tsx/dist/cli.mjs src/index.ts`,
      cwd: "../hkp-node",
      url: `${NODE_URL}/runtimes`,
      // Never reused: a server left over from another run would still hold
      // that run's boards and tickets.
      reuseExistingServer: false,
      timeout: 60_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
      env: {
        HKP_E2E_LOG_DIR: path.join(HERE, "test-results", "servers"),
        ALLOWED_ORIGINS: `http://localhost:${MEANDER_PORT}`,
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
            command: `"${process.execPath}" support/runtime-server.mjs rt "${RT_BIN}" ${RT_PORT}`,
            url: `${RT_URL}/runtimes`,
            reuseExistingServer: false,
            timeout: 60_000,
            gracefulShutdown: { signal: "SIGTERM" as const, timeout: 5_000 },
            env: {
              HKP_E2E_LOG_DIR: path.join(HERE, "test-results", "servers"),
              ALLOWED_ORIGINS: `http://localhost:${MEANDER_PORT}`,
              HOST: "127.0.0.1",
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
