#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { findRepositoryRoot, KnowledgeRepository } from "./repository.js";
import { createReadymadeMcpServer } from "./server.js";
import { startHttpServer } from "./http.js";

interface CliOptions {
  stdio: boolean;
  host?: string;
  port?: number;
  root?: string;
  rateLimit?: number;
  allowedHostnames: string[];
  allowedOriginHostnames: string[];
}

function parseArguments(argv: string[]): CliOptions {
  const result: CliOptions = {
    stdio: false,
    allowedHostnames: [],
    allowedOriginHostnames: [],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--stdio") result.stdio = true;
    else if (argument === "--host") result.host = argv[++index];
    else if (argument === "--port") result.port = Number(argv[++index]);
    else if (argument === "--root") result.root = argv[++index];
    else if (argument === "--rate-limit") result.rateLimit = Number(argv[++index]);
    else if (argument === "--allowed-host")
      result.allowedHostnames.push(argv[++index]);
    else if (argument === "--allowed-origin")
      result.allowedOriginHostnames.push(argv[++index]);
    else if (argument === "--help") {
      process.stdout.write(
        "Usage: readymade-mcp [--stdio] [--root PATH] [--host 127.0.0.1] [--port 8787] [--allowed-host HOSTNAME] [--allowed-origin HOSTNAME] [--rate-limit PER_MINUTE]\n" +
          "Without --root it serves the knowledge the package ships, or the checkout it is run in.\n" +
          "--rate-limit is requests to /mcp per client and minute (default 120; 0 for none).\n" +
          "Set READYMADE_MCP_TOKEN to require it as a bearer token on /mcp.\n",
      );
      process.exit(0);
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  if (result.port !== undefined && (!Number.isInteger(result.port) || result.port < 0 || result.port > 65_535)) throw new Error("--port must be an integer from 0 to 65535.");
  if (result.rateLimit !== undefined && (!Number.isInteger(result.rateLimit) || result.rateLimit < 0)) throw new Error("--rate-limit must be a whole number of requests per minute, or 0 for none.");
  return result;
}

// What `npm run bundle` wrote and the package ships beside dist/.
const packageRoot = path.resolve(import.meta.dirname, "..");
const packagedKnowledge = path.join(packageRoot, "bundle");

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const packaged = !options.root && existsSync(packagedKnowledge);
  const root = options.root ? await findRepositoryRoot(options.root) : packaged ? packagedKnowledge : await findRepositoryRoot();
  // Shipped knowledge is the package's own: its version is the build version.
  const packageVersion = (JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8")) as { version: string }).version;
  const repository = await KnowledgeRepository.create(root, process.env.READYMADE_BUILD_VERSION ?? (packaged ? packageVersion : undefined));
  if (options.stdio) {
    serveStdio(() => createReadymadeMcpServer(repository), { onerror: (error) => console.error(error) });
    return;
  }
  const { server, url } = await startHttpServer(repository, {
    host: options.host,
    port: options.port,
    allowedHostnames: options.allowedHostnames,
    allowedOriginHostnames: options.allowedOriginHostnames,
    rateLimit: options.rateLimit,
    // From the environment rather than an argument, which other users of the
    // machine can read in the process list.
    token: process.env.READYMADE_MCP_TOKEN || undefined,
  });
  console.log(`Readymade MCP knowledge server listening at ${url}`);
  console.log(`Indexed ${repository.stats().documents} documents, ${repository.stats().boards} boards, and ${repository.stats().contracts} runtime-specific contracts.`);
  const close = () => server.close(() => process.exit(0));
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
