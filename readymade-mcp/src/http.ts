import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { hostHeaderValidation, localhostHostValidation, localhostOriginValidation, originValidation, toNodeHandler } from "@modelcontextprotocol/node";
import { createReadymadeMcpServer } from "./server.js";
import type { KnowledgeRepository } from "./repository.js";

export interface HttpServerOptions {
  host?: string;
  port?: number;
  allowedHostnames?: string[];
  allowedOriginHostnames?: string[];
  /** When set, /mcp requires `Authorization: Bearer <token>`. */
  token?: string;
  /** Requests each client may make per minute; 0 for no limit. */
  rateLimit?: number;
}

function isLoopback(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

const loopbackNames = ["localhost", "127.0.0.1", "[::1]"];

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * Who a request comes from. Behind a reverse proxy on the same machine every
 * request arrives from loopback, so there the client is the address the proxy
 * appended last to X-Forwarded-For; from anywhere else that header is the
 * client's own word and is ignored.
 */
function clientOf(request: IncomingMessage): string {
  const remote = request.socket.remoteAddress ?? "";
  const loopback = remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
  const forwarded = request.headers["x-forwarded-for"];
  const last = (Array.isArray(forwarded) ? forwarded.join(",") : forwarded)?.split(",").pop()?.trim();
  return loopback && last ? last : remote;
}

/**
 * Counts requests per client in fixed one-minute windows. Answers how many
 * seconds remain until the window ends once a client is over `limit`, and
 * undefined while it is not. Counts are dropped with each window, so memory
 * stays bounded by the clients of a single minute.
 */
function rateLimiter(limit: number, windowMs = 60_000) {
  let windowStart = Date.now();
  let counts = new Map<string, number>();
  return (client: string): number | undefined => {
    const now = Date.now();
    if (now - windowStart >= windowMs) {
      windowStart = now;
      counts = new Map();
    }
    const count = (counts.get(client) ?? 0) + 1;
    counts.set(client, count);
    return count > limit ? Math.ceil((windowStart + windowMs - now) / 1000) : undefined;
  };
}

function authorized(request: IncomingMessage, expected: Buffer): boolean {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.authorization ?? "");
  return match !== null && timingSafeEqual(digest(match[1].trim()), expected);
}

export async function startHttpServer(repository: KnowledgeRepository, options: HttpServerOptions = {}): Promise<{ server: Server; url: string }> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 8787;
  if (!isLoopback(host) && (!options.allowedHostnames?.length || !options.allowedOriginHostnames?.length)) {
    throw new Error("Non-loopback binding requires explicit allowedHostnames and allowedOriginHostnames. Put a TLS reverse proxy in front of it before exposing it publicly.");
  }
  const limited = options.rateLimit === 0 ? undefined : rateLimiter(options.rateLimit ?? 120);
  const token = options.token ? digest(options.token) : undefined;
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
      // No credentials: the server uses no cookies, and a bearer token is an
      // explicit header, so an allowed origin never gets a credentialed request.
      response.setHeader("access-control-allow-origin", origin);
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
    const retryAfter = limited?.(clientOf(request));
    if (retryAfter !== undefined) {
      response.writeHead(429, { "content-type": "application/json", "retry-after": String(retryAfter) });
      response.end(JSON.stringify({ error: "Too many requests" }));
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
    if (token && !authorized(request, token)) {
      response.writeHead(401, { "content-type": "application/json", "www-authenticate": "Bearer" });
      response.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    void nodeHandler(request, response);
  });
  // Every exchange is one bounded tool call, so a client that trickles its
  // request is cut off instead of holding a connection open.
  server.headersTimeout = 10_000;
  server.requestTimeout = 30_000;
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
