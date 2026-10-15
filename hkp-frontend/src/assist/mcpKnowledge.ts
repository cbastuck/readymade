import type { CallToolResult, Client } from "@modelcontextprotocol/client";
import { bundledKnowledgeProvider } from "./documentation";
import type {
  AgenticKnowledgeProvider,
  AgentKnowledgeTool,
  KnowledgeDocument,
  KnowledgeKind,
  KnowledgeSearchRequest,
  KnowledgeSearchResult,
  ReadymadeKnowledgeProvider,
} from "./knowledge";

type JsonObject = Record<string, unknown>;

const CONNECT_TIMEOUT_MS = 5_000;
const TOOL_TIMEOUT_MS = 8_000;
const requiredTools = new Set(["search_knowledge", "read_document"]);
const agentToolNames = new Set([
  "get_service_contract",
  "find_compatible_services",
  "find_board_examples",
  "inspect_service_source",
  "validate_board",
]);

function object(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textError(result: CallToolResult): string {
  return result.content
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n") || "The MCP knowledge tool failed.";
}

function structured(result: CallToolResult): JsonObject {
  if (result.isError) throw new Error(textError(result));
  if (object(result.structuredContent)) return result.structuredContent;
  const text = result.content.find((item) => item.type === "text")?.text;
  if (text) {
    const parsed: unknown = JSON.parse(text);
    if (object(parsed)) return parsed;
  }
  throw new Error("The MCP knowledge server returned no structured result.");
}

function remoteKind(kind?: KnowledgeKind) {
  if (kind === "board-example") return "board";
  if (kind === "service-source") return "service";
  // The server distinguishes general and service documentation. Omitting the
  // filter searches both, which matches the bundled provider's behavior.
  return undefined;
}

function remoteRuntime(runtime?: string) {
  const value = runtime?.toLowerCase() ?? "";
  if (value.includes("browser")) return "browser";
  if (value.includes("node")) return "node";
  if (value.includes("python")) return "python";
  if (value.includes("hkp-rt") || value.includes("cpp") || value === "c++")
    return "cpp";
  if (value.includes("graphql")) return "graphql";
  if (value === "go" || value.includes("hkp-go")) return "go";
  return undefined;
}

function bundledPath(path: string): string {
  return path.startsWith("docs/content/")
    ? `docs/${path.slice("docs/content/".length)}`
    : path;
}

function remotePath(path: string): string {
  return path.startsWith("docs/") && !path.startsWith("docs/content/")
    ? `docs/content/${path.slice("docs/".length)}`
    : path;
}

export function normalizeMcpKnowledgeUrl(value: string): string {
  const url = new URL(value.trim());
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Use an HTTP or HTTPS MCP URL without credentials, query parameters, or fragments.",
    );
  }
  if (url.pathname === "/") url.pathname = "/mcp";
  return url.toString();
}

export class McpKnowledgeProvider implements AgenticKnowledgeProvider {
  readonly id: string;
  readonly availableOffline = true;
  private client?: Client;
  private connecting?: Promise<Client>;
  private fallbackReason?: Error;
  private fallbackReported = false;
  private agentTools: AgentKnowledgeTool[] = [];

  constructor(
    private readonly endpoint: string,
    private readonly signal: AbortSignal,
    private readonly fallback: ReadymadeKnowledgeProvider = bundledKnowledgeProvider,
    private readonly onFallback?: (error: Error) => void,
  ) {
    this.endpoint = normalizeMcpKnowledgeUrl(endpoint);
    this.id = `mcp+${fallback.id}`;
  }

  async searchKnowledge(
    request: KnowledgeSearchRequest,
  ): Promise<KnowledgeSearchResult[]> {
    return this.withFallback(
      async () => {
        const result = structured(
          await this.call("search_knowledge", {
            query: request.query,
            runtime: remoteRuntime(request.runtime),
            kind: remoteKind(request.kind),
            limit: 12,
          }),
        );
        if (!Array.isArray(result.results))
          throw new Error(
            "The MCP search result does not contain a results array.",
          );
        return result.results.map((value): KnowledgeSearchResult => {
          if (!object(value) || !object(value.provenance))
            throw new Error("The MCP search result has invalid provenance.");
          const path = value.provenance.path;
          if (
            typeof path !== "string" ||
            typeof value.score !== "number" ||
            typeof value.excerpt !== "string"
          ) {
            throw new Error("The MCP search result has an invalid shape.");
          }
          return {
            path: bundledPath(path),
            score: value.score,
            excerpt: value.excerpt,
          };
        });
      },
      () => this.fallback.searchKnowledge(request),
    );
  }

  async readDocuments(paths: string[]): Promise<KnowledgeDocument[]> {
    return this.withFallback(
      async () => {
        const result = structured(
          await this.call("read_document", { paths: paths.map(remotePath) }),
        );
        if (!Array.isArray(result.documents))
          throw new Error(
            "The MCP read result does not contain a documents array.",
          );
        return result.documents.map((value): KnowledgeDocument => {
          if (!object(value) || !object(value.provenance))
            throw new Error("The MCP document has invalid provenance.");
          const path = value.provenance.path;
          if (typeof path !== "string" || typeof value.content !== "string")
            throw new Error("The MCP document has an invalid shape.");
          return { path: bundledPath(path), content: value.content };
        });
      },
      () => this.fallback.readDocuments(paths.map(bundledPath)),
    );
  }

  async listAgentTools(): Promise<AgentKnowledgeTool[]> {
    return this.withFallback(
      async () => {
        await this.connect();
        return this.agentTools;
      },
      async () => [],
    );
  }

  async callAgentTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!agentToolNames.has(name))
      throw new Error(`The MCP knowledge operation '${name}' is not allowed.`);
    this.signal.throwIfAborted();
    if (this.fallbackReason)
      throw new Error(
        `The richer knowledge operation '${name}' needs the configured MCP server, which is unavailable for this turn.`,
      );
    let result: CallToolResult;
    try {
      result = await this.call(name, args);
    } catch (error) {
      this.signal.throwIfAborted();
      await this.tripFallback(error);
      throw new Error(
        `The richer knowledge operation '${name}' failed and has no bundled equivalent: ${this.fallbackReason!.message}`,
      );
    }
    // A successful MCP exchange may still contain a domain-level tool error,
    // such as an unknown service ID. Return that error to the model without
    // disabling otherwise healthy MCP tools for the remainder of the turn.
    return structured(result);
  }

  async close(): Promise<void> {
    this.connecting = undefined;
    const client = this.client;
    this.client = undefined;
    if (client) await client.close().catch(() => {});
  }

  private async withFallback<T>(
    remote: () => Promise<T>,
    offline: () => Promise<T>,
  ): Promise<T> {
    this.signal.throwIfAborted();
    if (this.fallbackReason) return offline();
    try {
      return await remote();
    } catch (error) {
      this.signal.throwIfAborted();
      await this.tripFallback(error);
      return offline();
    }
  }

  private async connect(): Promise<Client> {
    this.signal.throwIfAborted();
    if (this.client) return this.client;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      const { Client, StreamableHTTPClientTransport } = await import(
        "@modelcontextprotocol/client"
      );
      this.signal.throwIfAborted();
      const client = new Client(
        { name: "readymade-board-assist", version: "0.1.0" },
        {
          versionNegotiation: {
            mode: "auto",
            probe: { timeoutMs: 3_000, maxRetries: 0 },
          },
          listMaxPages: 4,
        },
      );
      const transport = new StreamableHTTPClientTransport(
        new URL(this.endpoint),
        { requestInit: { credentials: "omit" } },
      );
      try {
        await client.connect(transport, {
          signal: this.signal,
          timeout: CONNECT_TIMEOUT_MS,
        });
        const listed = await client.listTools(undefined, {
          signal: this.signal,
          timeout: CONNECT_TIMEOUT_MS,
        });
        const available = new Set(listed.tools.map((tool) => tool.name));
        for (const name of requiredTools) {
          if (!available.has(name))
            throw new Error(`The MCP server does not provide '${name}'.`);
        }
        this.agentTools = listed.tools
          .filter((tool) => agentToolNames.has(tool.name))
          .map((tool) => ({
            name: tool.name,
            description:
              tool.description ?? `Readymade knowledge operation ${tool.name}`,
            inputSchema: tool.inputSchema as Record<string, unknown>,
          }));
      } catch (error) {
        await client.close().catch(() => {});
        throw error;
      }
      this.client = client;
      return client;
    })();
    try {
      return await this.connecting;
    } finally {
      this.connecting = undefined;
    }
  }

  private async call(name: string, args: JsonObject): Promise<CallToolResult> {
    const client = await this.connect();
    this.signal.throwIfAborted();
    return client.callTool(
      {
        name,
        arguments: Object.fromEntries(
          Object.entries(args).filter(([, value]) => value !== undefined),
        ),
      },
      { signal: this.signal, timeout: TOOL_TIMEOUT_MS },
    );
  }

  private async tripFallback(error: unknown): Promise<void> {
    this.fallbackReason =
      error instanceof Error
        ? error
        : new Error("The MCP knowledge server failed.");
    if (!this.fallbackReported) {
      this.fallbackReported = true;
      this.onFallback?.(this.fallbackReason);
    }
    await this.close();
  }
}

export function boardAssistKnowledgeProvider(
  endpoint: string,
  signal: AbortSignal,
  onFallback?: (error: Error) => void,
): ReadymadeKnowledgeProvider {
  return endpoint.trim()
    ? new McpKnowledgeProvider(
        endpoint,
        signal,
        bundledKnowledgeProvider,
        onFallback,
      )
    : bundledKnowledgeProvider;
}
