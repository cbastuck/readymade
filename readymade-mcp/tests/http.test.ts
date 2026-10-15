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
});
