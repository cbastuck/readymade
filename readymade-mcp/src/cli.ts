#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { findRepositoryRoot, KnowledgeRepository } from "./repository.js";
import { createReadymadeMcpServer } from "./server.js";
import { startHttpServer } from "./http.js";

interface CliOptions {
  stdio: boolean;
  host?: string;
  port?: number;
  root?: string;
}

function parseArguments(argv: string[]): CliOptions {
  const result: CliOptions = { stdio: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--stdio") result.stdio = true;
    else if (argument === "--host") result.host = argv[++index];
    else if (argument === "--port") result.port = Number(argv[++index]);
    else if (argument === "--root") result.root = argv[++index];
    else if (argument === "--help") {
      process.stdout.write("Usage: readymade-mcp [--stdio] [--root PATH] [--host 127.0.0.1] [--port 8787]\n");
      process.exit(0);
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  if (result.port !== undefined && (!Number.isInteger(result.port) || result.port < 0 || result.port > 65_535)) throw new Error("--port must be an integer from 0 to 65535.");
  return result;
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const root = options.root ? await findRepositoryRoot(options.root) : await findRepositoryRoot();
  const repository = await KnowledgeRepository.create(root);
  if (options.stdio) {
    serveStdio(() => createReadymadeMcpServer(repository), { onerror: (error) => console.error(error) });
    return;
  }
  const { server, url } = await startHttpServer(repository, { host: options.host, port: options.port });
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
