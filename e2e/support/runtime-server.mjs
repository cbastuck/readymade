// Playwright owns this wrapper and stops it with SIGTERM. The wrapper owns
// only its child and its freshly-created data directory, including on failure.
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const [kind, ...args] = process.argv.slice(2);
if (!["node", "rt"].includes(kind) || !args.length || !process.env.HKP_E2E_LOG_DIR) {
  throw new Error("runtime-server needs a runtime kind, command arguments and HKP_E2E_LOG_DIR");
}
const directory = mkdtempSync(path.join(tmpdir(), `readymade-e2e-${kind}-`));
mkdirSync(process.env.HKP_E2E_LOG_DIR, { recursive: true });
const log = path.join(process.env.HKP_E2E_LOG_DIR, `${kind}.log`);
writeFileSync(log, `[e2e] Disposable data: ${directory}\n`);
const env = { ...process.env };
env.HKP_COORDINATOR_LINKS_FILE = path.join(directory, "links.json");
if (kind === "node") {
  Object.assign(env, {
    HKP_COORDINATOR_DATA_DIR: path.join(directory, "boards"),
    HKP_COORDINATOR_LOG_DIR: path.join(directory, "logs"),
    HKP_COORDINATOR_LINKS_FILE: path.join(directory, "links.json"),
    HKP_STORE_DIR: path.join(directory, "store"),
    HKP_DB_DIR: path.join(directory, "db"),
    HKP_FILES_DIR: path.join(directory, "files"),
  });
}
const child = spawn(kind === "node" ? process.execPath : args.shift(), args, { env, stdio: ["ignore", "pipe", "pipe"] });
child.stdout.on("data", (bytes) => { appendFileSync(log, bytes); process.stdout.write(bytes); });
child.stderr.on("data", (bytes) => { appendFileSync(log, bytes); process.stderr.write(bytes); });
let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => {
  stopping = true;
  child.kill(signal);
});
child.on("error", (error) => {
  appendFileSync(log, `${error.stack}\n`);
  process.stderr.write(`${error.stack}\n`);
});
child.on("close", (code) => {
  try {
    rmSync(directory, { recursive: true, force: true });
    appendFileSync(log, "[e2e] Disposable data removed\n");
  } catch (error) {
    appendFileSync(log, `[e2e] Cleanup failed: ${error}\n`);
    process.stderr.write(`[e2e] Cleanup failed: ${error}\n`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = stopping ? 0 : (code ?? 1);
});
