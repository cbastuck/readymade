import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Combined build version shown in the start page badge:
 * `<version from hkp-frontend's package.json>.<short git hash of this build>`.
 * Computed at build time and injected via Vite's `define`.
 */
export function readBuildVersion(rootDir: string): string {
  let version = "0.0.0";
  try {
    const pkg = JSON.parse(
      readFileSync(
        path.resolve(rootDir, "../../hkp-frontend/package.json"),
        "utf8",
      ),
    ) as { version?: string };
    version = pkg.version ?? version;
  } catch {
    // keep the fallback version
  }

  let hash = "dev";
  try {
    hash = execSync("git rev-parse --short HEAD", { cwd: rootDir })
      .toString()
      .trim();
  } catch {
    // not a git checkout (e.g. source tarball) — keep the fallback
  }

  return `${version}.${hash}`;
}
