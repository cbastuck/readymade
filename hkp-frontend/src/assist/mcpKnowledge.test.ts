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

import { McpKnowledgeProvider, normalizeMcpKnowledgeUrl } from "./mcpKnowledge";

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

beforeEach(() => {
  vi.clearAllMocks();
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
});
