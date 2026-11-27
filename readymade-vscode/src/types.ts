export type Thenable<T> = PromiseLike<T>;

export type Remote = {
  name: string;
  url: string;
  port?: number;
  color?: string;
  aliases?: string[];
};

export type RuntimeSettings = {
  allowExternalRuntimeAccess: boolean;
  allowedUsers: string[];
};

export type BoardEntryMeta = {
  name: string;
  modified: string;
};

export interface BoardStore {
  listNames(): Promise<string[]> | string[];
  listEntries(): Promise<BoardEntryMeta[]> | BoardEntryMeta[];
  get(name: string): Promise<unknown | undefined> | unknown | undefined;
  set(name: string, board: unknown): Promise<void> | void;
  delete(name: string): Promise<void> | void;
}

export interface StateStore {
  getRemotes(): Promise<Remote[]> | Remote[];
  setRemotes(remotes: Remote[]): Promise<void> | void;
  getSettings(): Promise<RuntimeSettings> | RuntimeSettings;
  setSettings(settings: RuntimeSettings): Promise<void> | void;
}

export interface TextDocumentLike {
  getText(): string;
  fileName?: string;
  applyEdit(newText: string): Promise<boolean>;
}

export type HkpRequest = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export type HkpResponsePayload = {
  status: number;
  headers: Record<string, string>;
  body: string | null;
};

export type WebviewFetchMessage = {
  type: "hkp-fetch";
  requestId: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string | null;
};

export type WebviewFetchResponseMessage = {
  type: "hkp-fetch-response";
  requestId: string;
  status: number;
  headers: Record<string, string>;
  body: string | null;
};

export type WebviewDocumentChangedMessage = {
  type: "hkp-document-changed";
  board: unknown;
};

export type WebviewMessage =
  | WebviewFetchMessage
  | WebviewFetchResponseMessage
  | WebviewDocumentChangedMessage;

export interface ConfigurationProperty {
  property: string;
  type: string;
  defaultValue?: string;
  description: string;
}

export type RuntimeName = "browser" | "node" | "python" | "cpp" | "go" | "graphql";

export interface ServiceContract {
  serviceId: string;
  name: string;
  runtime: RuntimeName;
  aliases: string[];
  inputTypes: string[];
  outputTypes: string[];
  configuration: ConfigurationProperty[];
  summary: string;
}
