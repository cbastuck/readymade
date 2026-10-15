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
}
