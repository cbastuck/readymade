import { createServer, type Server } from "node:http";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { hostHeaderValidation, localhostHostValidation, localhostOriginValidation, originValidation, toNodeHandler } from "@modelcontextprotocol/node";
import { createReadymadeMcpServer } from "./server.js";
import type { KnowledgeRepository } from "./repository.js";

export interface HttpServerOptions {
  host?: string;
  port?: number;
  allowedHostnames?: string[];
  allowedOriginHostnames?: string[];
}

function isLoopback(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

const loopbackNames = ["localhost", "127.0.0.1", "[::1]"];

export async function startHttpServer(repository: KnowledgeRepository, options: HttpServerOptions = {}): Promise<{ server: Server; url: string }> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 8787;
  if (!isLoopback(host) && (!options.allowedHostnames?.length || !options.allowedOriginHostnames?.length)) {
    throw new Error("Non-loopback binding requires explicit allowedHostnames and allowedOriginHostnames. Authentication should be added before exposing this server publicly.");
  }
  const validateHost = isLoopback(host)
    ? options.allowedHostnames?.length
      ? hostHeaderValidation([...new Set([...loopbackNames, ...options.allowedHostnames])])
      : localhostHostValidation()
    : hostHeaderValidation(options.allowedHostnames!);
  const validateOrigin = isLoopback(host)
    ? options.allowedOriginHostnames?.length
      ? originValidation([...new Set([...loopbackNames, ...options.allowedOriginHostnames])])
      : localhostOriginValidation()
    : originValidation(options.allowedOriginHostnames!);
  const handler = createMcpHandler(() => createReadymadeMcpServer(repository), {
    responseMode: "auto",
    legacy: "stateless",
    onerror: (error) => console.error("Readymade MCP request error:", error),
  });
  const nodeHandler = toNodeHandler(handler, { maxRequestBodySize: 1_048_576 });
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).pathname;
    if (!validateHost(request, response) || !validateOrigin(request, response)) return;
    const origin = request.headers.origin;
    if (origin) {
      response.setHeader("access-control-allow-origin", origin);
      response.setHeader("access-control-allow-credentials", "true");
      response.setHeader("access-control-expose-headers", "Mcp-Protocol-Version, Mcp-Session-Id");
      response.setHeader("vary", "Origin");
    }
    if (request.method === "OPTIONS") {
      response.setHeader("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
      response.setHeader(
        "access-control-allow-headers",
        request.headers["access-control-request-headers"] ?? "Content-Type, Accept, Authorization, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
      );
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.method === "GET" && pathname === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, ...repository.stats() }));
      return;
    }
    if (pathname !== "/mcp") {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Not found" }));
      return;
    }
    void nodeHandler(request, response);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  const boundPort = typeof address === "object" && address ? address.port : port;
  return { server, url: `http://${host.includes(":") ? `[${host}]` : host}:${boundPort}/mcp` };
}
