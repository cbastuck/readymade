import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

import type { HostOptions } from "./support/test";
import {
  IDENTITY_AUDIENCE,
  IDENTITY_DOMAIN,
  IDENTITY_KEYS_FILE,
  JWKS_PORT,
  JWKS_URL,
} from "./support/identities";

/**
 * The golden-path shoot (`plans/TODO-GOLDEN-PATH-VIDEO.md`): the real app,
 * driven through the story by two people, with every shot it takes written
 * down for the video to frame.
 *
 * Not a test suite and never part of `npm test`: it asserts only what the
 * story needs to be true, and it writes footage. What makes it different from
 * the cloud suite is that people sign in. hkp-node runs with JWT
 * authentication against keys this config serves (`support/jwks-server.mjs`),
 * so the owner and the member are verified identities with their own
 * addresses, and every caller the board sees is one a server vouched for.
 *
 *   npm run film                          # rehearse and shoot
 *   FILM_ASSIST=record npm run film       # record a real assistant run once
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MEANDER_PORT = 8599;
export const FILM_NODE_PORT = 18180;
export const FILM_NODE_URL = `http://127.0.0.1:${FILM_NODE_PORT}`;
const ANTHROPIC = "https://api.anthropic.com";

export default defineConfig<HostOptions>({
  testDir: "./film",
  testMatch: "**/*.film.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // A take is long: it deploys, signs two people in and books.
  timeout: 5 * 60_000,
  reporter: [["list"]],
  outputDir: "test-results/film",

  use: {
    serviceWorkers: "block",
    // A real assistant run needs the API; a replayed one never reaches it.
    serverOrigins: [
      FILM_NODE_URL,
      ...(process.env.FILM_ASSIST === "record" ? [ANTHROPIC] : []),
    ],
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    {
      name: "film",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
        baseURL: `http://localhost:${MEANDER_PORT}`,
        profile: "desktop",
      },
    },
  ],

  webServer: [
    {
      command: `"${process.execPath}" node_modules/vite/bin/vite.js --port ${MEANDER_PORT} --strictPort`,
      cwd: "../meander/frontend",
      url: `http://localhost:${MEANDER_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `"${process.execPath}" support/jwks-server.mjs ${JWKS_PORT} "${IDENTITY_KEYS_FILE}"`,
      url: `http://127.0.0.1:${JWKS_PORT}/`,
      // Never reused: the keys a token is signed with are made at start.
      reuseExistingServer: false,
      timeout: 15_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 2_000 },
    },
    {
      command: `"${process.execPath}" ../e2e/support/runtime-server.mjs node node_modules/tsx/dist/cli.mjs src/index.ts`,
      cwd: "../hkp-node",
      url: `${FILM_NODE_URL}/runtimes`,
      reuseExistingServer: false,
      timeout: 60_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
      env: {
        HKP_E2E_LOG_DIR: path.join(HERE, "test-results", "film-servers"),
        ALLOWED_ORIGINS: `http://localhost:${MEANDER_PORT}`,
        SKIP_LOADING_ENV: "true",
        HOST: "127.0.0.1",
        EXTERNAL_HOST: "127.0.0.1",
        PORT: String(FILM_NODE_PORT),
        COORDINATOR_ENABLED: "true",
        AUTH0_DOMAIN: IDENTITY_DOMAIN,
        AUTH0_AUDIENCE: IDENTITY_AUDIENCE,
        HKP_TEST_JWKS_URI: JWKS_URL,
        ALLOWED_EMAILS: "",
        HKP_MOUNT_SECRET: "film",
        HKP_COORDINATOR_DATA_DIR: "",
        HKP_COORDINATOR_LOG_DIR: "",
        HKP_COORDINATOR_LINKS_FILE: "",
        HKP_STORE_DIR: "",
        HKP_DB_DIR: "",
        HKP_FILES_DIR: "",
        // The board draws days from this clock; a fixed zone keeps "tomorrow
        // at six" the same hour whoever runs the shoot.
        TZ: "Europe/Berlin",
      },
    },
  ],
});
