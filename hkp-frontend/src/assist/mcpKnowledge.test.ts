import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReadymadeKnowledgeProvider } from "./knowledge";

const sdk = vi.hoisted(() => ({
  connect: vi.fn(),
  listTools: vi.fn(),
  callTool: vi.fn(),
  close: vi.fn(),
  transport: vi.fn(),
}));

vi.mock("@modelcontextprotocol/client", () => ({
  Client: class {
    connect = sdk.connect;
    listTools = sdk.listTools;
    callTool = sdk.callTool;
    close = sdk.close;
  },
  StreamableHTTPClientTransport: class {
    constructor(url: URL, options: unknown) {
      sdk.transport(url, options);
    }
  },
}));

import {
  McpKnowledgeProvider,
  mcpFailureKind,
  normalizeMcpKnowledgeUrl,
  resetMcpKnowledgeCooldowns,
} from "./mcpKnowledge";

function fallback(overrides: Partial<ReadymadeKnowledgeProvider> = {}) {
  return {
    id: "bundled-test",
    availableOffline: true,
    searchKnowledge: vi.fn(async () => [
      { path: "docs/services/timer.md", score: 1, excerpt: "Timer" },
    ]),
    readDocuments: vi.fn(async (paths: string[]) =>
      paths.map((path) => ({ path, content: "bundled" })),
    ),
    ...overrides,
  } satisfies ReadymadeKnowledgeProvider;
}

const searchResult = {
  content: [],
  structuredContent: {
    results: [
      {
        score: 10,
        excerpt: "Timer",
        provenance: { path: "docs/content/services/timer.md" },
      },
    ],
  },
};

function provider(
  bundled = fallback(),
  onFallback?: (error: Error) => void,
) {
  return new McpKnowledgeProvider(
    "http://127.0.0.1:8787/mcp",
    new AbortController().signal,
    bundled,
    onFallback,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  resetMcpKnowledgeCooldowns();
  sdk.connect.mockResolvedValue(undefined);
  sdk.listTools.mockResolvedValue({
    tools: [
      { name: "search_knowledge" },
      { name: "read_document" },
      {
        name: "get_service_contract",
        description: "Get a contract",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  });
  sdk.close.mockResolvedValue(undefined);
});

describe("MCP knowledge provider", () => {
  it("normalizes a root endpoint and rejects credentials", () => {
    expect(normalizeMcpKnowledgeUrl("http://127.0.0.1:8787")).toBe(
      "http://127.0.0.1:8787/mcp",
    );
    expect(() =>
      normalizeMcpKnowledgeUrl("http://user:secret@127.0.0.1:8787/mcp"),
    ).toThrow("without credentials");
  });

  it("maps structured MCP search and read results to the provider boundary", async () => {
    sdk.callTool
      .mockResolvedValueOnce({
        content: [],
        structuredContent: {
          results: [
            {
              score: 20,
              excerpt: "Filter conditions",
              provenance: { path: "docs/content/services/filter.md" },
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        content: [],
        structuredContent: {
          documents: [
            {
              content: "# Filter",
              provenance: { path: "docs/content/services/filter.md" },
            },
          ],
        },
      });
    const provider = new McpKnowledgeProvider(
      "http://127.0.0.1:8787/mcp",
      new AbortController().signal,
      fallback(),
    );
    expect(
      await provider.searchKnowledge({
        query: "filter conditions",
        runtime: "Browser Runtime",
      }),
    ).toEqual([
      {
        path: "docs/services/filter.md",
        score: 20,
        excerpt: "Filter conditions",
      },
    ]);
    expect(await provider.readDocuments(["docs/content/services/filter.md"])).toEqual([
      { path: "docs/services/filter.md", content: "# Filter" },
    ]);
    expect(sdk.callTool).toHaveBeenNthCalledWith(
      1,
      {
        name: "search_knowledge",
        arguments: {
          query: "filter conditions",
          runtime: "browser",
          limit: 12,
        },
      },
      expect.objectContaining({ timeout: 8_000 }),
    );
    await provider.close();
    expect(sdk.close).toHaveBeenCalled();
  });

  it("translates bundled documentation paths before reading through MCP", async () => {
    sdk.callTool.mockResolvedValueOnce({
      content: [],
      structuredContent: {
        documents: [
          {
            content: "# Runtime",
            provenance: { path: "docs/content/concepts/runtime.md" },
          },
        ],
      },
    });
    const provider = new McpKnowledgeProvider(
      "http://127.0.0.1:8787/mcp",
      new AbortController().signal,
      fallback(),
    );

    await expect(provider.readDocuments(["docs/concepts/runtime.md"])).resolves.toEqual([
      {
        path: "docs/concepts/runtime.md",
        content: "# Runtime",
      },
    ]);
    expect(sdk.callTool).toHaveBeenCalledWith(
      {
        name: "read_document",
        arguments: { paths: ["docs/content/concepts/runtime.md"] },
      },
      expect.objectContaining({ timeout: 8_000 }),
    );
  });

  it("falls back for the rest of the turn after a remote failure", async () => {
    sdk.callTool
      .mockResolvedValueOnce({
        content: [],
        structuredContent: {
          results: [
            {
              score: 10,
              excerpt: "Timer",
              provenance: { path: "docs/content/services/timer.md" },
            },
          ],
        },
      })
      .mockRejectedValueOnce(new Error("connection lost"));
    const bundled = fallback();
    const onFallback = vi.fn();
    const provider = new McpKnowledgeProvider(
      "http://127.0.0.1:8787/mcp",
      new AbortController().signal,
      bundled,
      onFallback,
    );
    await provider.searchKnowledge({ query: "timer" });
    expect(await provider.readDocuments(["docs/content/services/timer.md"])).toEqual([
      { path: "docs/services/timer.md", content: "bundled" },
    ]);
    expect(bundled.readDocuments).toHaveBeenCalledWith([
      "docs/services/timer.md",
    ]);
    expect(onFallback).toHaveBeenCalledWith(
      expect.objectContaining({ message: "connection lost" }),
    );
    await provider.searchKnowledge({ query: "again" });
    expect(sdk.callTool).toHaveBeenCalledTimes(2);
    expect(bundled.searchKnowledge).toHaveBeenCalledWith({ query: "again" });
  });

  it("advertises and calls only allowlisted richer operations", async () => {
    sdk.callTool.mockResolvedValueOnce({
      content: [],
      structuredContent: { contract: { serviceId: "timer" } },
    });
    const provider = new McpKnowledgeProvider(
      "http://127.0.0.1:8787/mcp",
      new AbortController().signal,
      fallback(),
    );
    expect(await provider.listAgentTools()).toEqual([
      {
        name: "get_service_contract",
        description: "Get a contract",
        inputSchema: { type: "object", properties: {} },
      },
    ]);
    await expect(
      provider.callAgentTool("get_service_contract", {
        serviceId: "timer",
        runtime: "node",
      }),
    ).resolves.toEqual({ contract: { serviceId: "timer" } });
    await expect(provider.callAgentTool("unknown", {})).rejects.toThrow(
      "not allowed",
    );
  });

  it("keeps richer tools available after a domain-level tool error", async () => {
    sdk.callTool
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "No indexed contract for 'missing'." }],
        isError: true,
      })
      .mockResolvedValueOnce({
        content: [],
        structuredContent: { services: [] },
      });
    const onFallback = vi.fn();
    const provider = new McpKnowledgeProvider(
      "http://127.0.0.1:8787/mcp",
      new AbortController().signal,
      fallback(),
      onFallback,
    );

    await expect(
      provider.callAgentTool("get_service_contract", {
        serviceId: "missing",
        runtime: "node",
      }),
    ).rejects.toThrow("No indexed contract for 'missing'.");
    await expect(
      provider.callAgentTool("find_compatible_services", {
        inputType: "String",
        outputType: "String",
        runtime: "node",
      }),
    ).resolves.toEqual({ services: [] });
    expect(onFallback).not.toHaveBeenCalled();
    expect(sdk.close).not.toHaveBeenCalled();
  });

  it("propagates cancellation without treating it as server failure", async () => {
    const controller = new AbortController();
    controller.abort();
    const bundled = fallback();
    const onFallback = vi.fn();
    const provider = new McpKnowledgeProvider(
      "http://127.0.0.1:8787/mcp",
      controller.signal,
      bundled,
      onFallback,
    );
    await expect(provider.searchKnowledge({ query: "timer" })).rejects.toThrow();
    expect(bundled.searchKnowledge).not.toHaveBeenCalled();
    expect(onFallback).not.toHaveBeenCalled();
  });
  it("tells a refused call from an unavailable server", () => {
    expect(mcpFailureKind({ code: -32602, message: "Invalid params" })).toBe(
      "call",
    );
    expect(mcpFailureKind(new TypeError("Failed to fetch"))).toBe("server");
    expect(mcpFailureKind({ code: "REQUEST_TIMEOUT" })).toBe("server");
    expect(mcpFailureKind({ code: "CLIENT_HTTP_NOT_IMPLEMENTED" })).toBe(
      "server",
    );
  });

  it("answers a refused read from bundled docs and keeps using MCP", async () => {
    sdk.callTool
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "Path is not an indexed document" }],
        isError: true,
      })
      .mockResolvedValueOnce(searchResult);
    const bundled = fallback();
    const onFallback = vi.fn();
    const knowledge = provider(bundled, onFallback);

    expect(await knowledge.readDocuments(["docs/services/timer.md"])).toEqual([
      { path: "docs/services/timer.md", content: "bundled" },
    ]);
    await knowledge.searchKnowledge({ query: "timer" });
    expect(sdk.callTool).toHaveBeenCalledTimes(2);
    expect(bundled.searchKnowledge).not.toHaveBeenCalled();
    expect(onFallback).not.toHaveBeenCalled();
    expect(sdk.close).not.toHaveBeenCalled();
  });

  it("keeps richer tools after a JSON-RPC error from a reachable server", async () => {
    sdk.callTool
      .mockRejectedValueOnce(
        Object.assign(new Error("Tool inspect_service_source disabled"), {
          code: -32602,
        }),
      )
      .mockResolvedValueOnce({
        content: [],
        structuredContent: { contract: { serviceId: "timer" } },
      });
    const onFallback = vi.fn();
    const knowledge = provider(fallback(), onFallback);
    await expect(
      knowledge.callAgentTool("inspect_service_source", {}),
    ).rejects.toThrow("disabled");
    await expect(
      knowledge.callAgentTool("get_service_contract", {}),
    ).resolves.toEqual({ contract: { serviceId: "timer" } });
    expect(onFallback).not.toHaveBeenCalled();
  });

  it("tries a server that failed fast again on the next turn", async () => {
    sdk.connect.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await provider().searchKnowledge({ query: "timer" });
    sdk.callTool.mockResolvedValueOnce(searchResult);
    const bundled = fallback();
    await provider(bundled).searchKnowledge({ query: "timer" });
    expect(sdk.connect).toHaveBeenCalledTimes(2);
    expect(bundled.searchKnowledge).not.toHaveBeenCalled();
  });

  it("skips a server that timed out for later turns, then tries it again", async () => {
    vi.useFakeTimers();
    sdk.callTool.mockRejectedValueOnce(
      Object.assign(new Error("Request timed out"), { code: "REQUEST_TIMEOUT" }),
    );
    await provider().searchKnowledge({ query: "timer" });
    expect(sdk.connect).toHaveBeenCalledTimes(1);

    const onFallback = vi.fn();
    const bundled = fallback();
    const skipped = provider(bundled, onFallback);
    await skipped.searchKnowledge({ query: "timer" });
    expect(sdk.connect).toHaveBeenCalledTimes(1);
    expect(bundled.searchKnowledge).toHaveBeenCalled();
    expect(onFallback).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Request timed out"),
      }),
    );
    expect(await skipped.listAgentTools()).toEqual([]);

    vi.advanceTimersByTime(60_001);
    sdk.callTool.mockResolvedValueOnce(searchResult);
    await provider().searchKnowledge({ query: "timer" });
    expect(sdk.connect).toHaveBeenCalledTimes(2);
  });
});
