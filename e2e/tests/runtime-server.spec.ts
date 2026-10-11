import { spawn } from "node:child_process";
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { test, expect } from "../support/test";

test.skip(({ profile }) => profile !== "web", "process ownership is independent of the host profile");
const wrapper = fileURLToPath(new URL("../support/runtime-server.mjs", import.meta.url));

for (const stopping of [false, true]) {
  test(stopping ? "runtime shutdown removes its disposable data" : "runtime startup failure keeps logs and removes disposable data", async ({}, testInfo) => {
    const directory = testInfo.outputPath("server");
    const child = spawn(process.execPath, [wrapper, "node", "-e", stopping
      ? 'console.log("fixture-ready"); setInterval(() => {}, 1000)'
      : 'console.error("synthetic startup failure"); process.exit(7)'], {
      env: { ...process.env, HKP_E2E_LOG_DIR: directory }, stdio: ["ignore", "pipe", "pipe"],
    });
    const exited = new Promise<number | null>((resolve, reject) => { child.on("close", resolve); child.on("error", reject); });
    try {
      if (stopping) {
        await new Promise<void>((resolve, reject) => {
          child.stdout.on("data", (chunk) => { if (String(chunk).includes("fixture-ready")) resolve(); });
          child.on("error", reject);
          child.on("close", () => reject(new Error("Runtime exited before readiness")));
        });
        child.kill("SIGTERM");
      }
      expect(await exited).toBe(stopping ? 0 : 7);
      const log = await readFile(path.join(directory, "node.log"), "utf8");
      expect(log).toContain(stopping ? "fixture-ready" : "synthetic startup failure");
      expect(log).toContain("Disposable data removed");
      const temporary = log.match(/Disposable data: (.+)/)![1];
      await expect(access(temporary)).rejects.toThrow();
    } finally {
      if (child.exitCode === null) { child.kill("SIGTERM"); await exited; }
    }
  });
}
