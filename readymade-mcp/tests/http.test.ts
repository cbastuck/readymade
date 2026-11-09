import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { KnowledgeRepository } from "../src/repository.js";
import { startHttpServer } from "../src/http.js";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const repository = await KnowledgeRepository.create(path.resolve(import.meta.dirname, "../.."), "test-build");
  const started = await startHttpServer(repository, { port: 0 });
  server = started.server;
  baseUrl = started.url.replace(/\/mcp$/, "");
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("HTTP server", () => {
  it("serves health and rejects unrelated paths", async () => {
    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual(expect.objectContaining({ ok: true, buildVersion: "test-build" }));
    expect((await fetch(`${baseUrl}/anything`)).status).toBe(404);
  });

  it("allows loopback browser preflight and rejects other origins", async () => {
    const preflight = await fetch(`${baseUrl}/mcp`, {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-headers": "content-type,mcp-protocol-version",
      },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    const rejected = await fetch(`${baseUrl}/health`, { headers: { origin: "https://example.com" } });
    expect(rejected.status).toBe(403);
  });

  it("can explicitly allow a non-loopback browser origin", async () => {
    const repository = await KnowledgeRepository.create(
      path.resolve(import.meta.dirname, "../.."),
      "test-build",
    );
    const extra = await startHttpServer(repository, {
      port: 0,
      allowedOriginHostnames: ["readymadeit.com"],
    });
    try {
      const response = await fetch(extra.url.replace(/\/mcp$/, "/health"), {
        headers: { origin: "https://readymadeit.com" },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBe(
        "https://readymadeit.com",
      );
    } finally {
      await new Promise<void>((resolve) => extra.server.close(() => resolve()));
    }
  });

  it("serves the MCP initialize exchange", async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } },
      }),
    });
    expect(response.status).toBe(200);
    const text = await response.text();
    const payload = response.headers.get("content-type")?.includes("text/event-stream")
      ? text.split("\n").find((line) => line.startsWith("data: "))?.slice(6)
      : text;
    expect(payload).toBeTruthy();
    const body = JSON.parse(payload!) as { result: { serverInfo: { name: string }; capabilities: { tools: unknown } } };
    expect(body.result.serverInfo.name).toBe("readymade-knowledge");
    expect(body.result.capabilities.tools).toBeDefined();
  });

  it("never allows credentialed cross-origin requests", async () => {
    const response = await fetch(`${baseUrl}/health`, { headers: { origin: "http://localhost:5173" } });
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect(response.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("refuses a tool call whose arguments are too large to validate", async () => {
    const call = (board: unknown) =>
      rpc(`${baseUrl}/mcp`, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "validate_board", arguments: { board } } });
    const small = await call({ runtimes: [], services: {} });
    expect(small.error).toBeUndefined();
    const large = await call({ runtimes: [], services: { ui: Array.from({ length: 25_000 }, () => 0) } });
    expect(JSON.stringify(large)).toMatch(/maximum of 20000 elements/);
  });

  it("limits each client's requests to /mcp per minute", async () => {
    const repository = await KnowledgeRepository.create(path.resolve(import.meta.dirname, "../.."), "test-build");
    const limited = await startHttpServer(repository, { port: 0, rateLimit: 2 });
    try {
      const initialize = (client: string) =>
        fetch(limited.url, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "x-forwarded-for": client },
          body: JSON.stringify(initializeRequest),
        });
      expect((await initialize("203.0.113.1")).status).toBe(200);
      expect((await initialize("203.0.113.1")).status).toBe(200);
      const over = await initialize("203.0.113.1");
      expect(over.status).toBe(429);
      expect(Number(over.headers.get("retry-after"))).toBeGreaterThan(0);
      // Behind a proxy on loopback, each forwarded client has its own budget.
      expect((await initialize("203.0.113.2")).status).toBe(200);
      // Preflight and health are not counted.
      expect((await fetch(limited.url, { method: "OPTIONS", headers: { origin: "http://localhost:5173", "x-forwarded-for": "203.0.113.1" } })).status).toBe(204);
      expect((await fetch(limited.url.replace(/\/mcp$/, "/health"), { headers: { "x-forwarded-for": "203.0.113.1" } })).status).toBe(200);
    } finally {
      await new Promise<void>((resolve) => limited.server.close(() => resolve()));
    }
  });

  it("requires the bearer token on /mcp when one is configured", async () => {
    const repository = await KnowledgeRepository.create(path.resolve(import.meta.dirname, "../.."), "test-build");
    const guarded = await startHttpServer(repository, { port: 0, token: "s3cret" });
    try {
      const initialize = (headers: Record<string, string>) =>
        fetch(guarded.url, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
          body: JSON.stringify(initializeRequest),
        });
      const missing = await initialize({});
      expect(missing.status).toBe(401);
      expect(missing.headers.get("www-authenticate")).toBe("Bearer");
      expect((await initialize({ authorization: "Bearer wrong" })).status).toBe(401);
      expect((await initialize({ authorization: "Bearer s3cret" })).status).toBe(200);
      // Preflight and health carry no token.
      expect((await fetch(guarded.url, { method: "OPTIONS", headers: { origin: "http://localhost:5173" } })).status).toBe(204);
      expect((await fetch(guarded.url.replace(/\/mcp$/, "/health"))).status).toBe(200);
    } finally {
      await new Promise<void>((resolve) => guarded.server.close(() => resolve()));
    }
  });
});

const initializeRequest = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } },
};

async function rpc(url: string, body: unknown): Promise<{ result?: unknown; error?: unknown }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const payload = response.headers.get("content-type")?.includes("text/event-stream")
    ? text.split("\n").find((line) => line.startsWith("data: "))?.slice(6)
    : text;
  return JSON.parse(payload!);
}
