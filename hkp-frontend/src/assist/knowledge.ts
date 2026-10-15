/** A document category understood by Readymade knowledge providers. */
export type KnowledgeKind =
  | "documentation"
  | "board-example"
  | "service-source";

export type KnowledgeSearchRequest = {
  query: string;
  runtime?: string;
  kind?: KnowledgeKind;
};

export type KnowledgeSearchResult = {
  path: string;
  score: number;
  excerpt: string;
};

export type KnowledgeDocument = {
  path: string;
  content: string;
};

export type AgentKnowledgeTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

/**
 * The deliberately small boundary Board Assist needs today. The bundled
 * implementation keeps native and browser hosts useful offline; a future MCP
 * implementation can satisfy the same calls and advertise richer operations
 * separately without putting transport concerns in Board Assist.
 */
export interface ReadymadeKnowledgeProvider {
  readonly id: string;
  readonly availableOffline: boolean;
  searchKnowledge(
    request: KnowledgeSearchRequest,
  ): Promise<KnowledgeSearchResult[]>;
  readDocuments(paths: string[]): Promise<KnowledgeDocument[]>;
  close?(): Promise<void>;
}

/** Explicit capability implemented only by providers with richer operations. */
export interface AgenticKnowledgeProvider extends ReadymadeKnowledgeProvider {
  listAgentTools(): Promise<AgentKnowledgeTool[]>;
  callAgentTool(name: string, args: Record<string, unknown>): Promise<unknown>;
}

export function isAgenticKnowledgeProvider(
  provider: ReadymadeKnowledgeProvider,
): provider is AgenticKnowledgeProvider {
  return (
    "listAgentTools" in provider &&
    typeof provider.listAgentTools === "function" &&
    "callAgentTool" in provider &&
    typeof provider.callAgentTool === "function"
  );
}
