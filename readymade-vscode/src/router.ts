import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import type {
  BoardEntryMeta,
  BoardStore,
  HkpRequest,
  HkpResponsePayload,
  Remote,
  RuntimeSettings,
  StateStore,
  TextDocumentLike,
} from "./types.js";

const DEFAULT_SETTINGS: RuntimeSettings = {
  allowExternalRuntimeAccess: false,
  allowedUsers: [],
};

export class InMemoryBoardStore implements BoardStore {
  readonly boards: Record<string, unknown> = {};
  readonly modified: Record<string, string> = {};

  constructor(initialBoards: Record<string, unknown> = {}) {
    const now = new Date().toISOString();
    for (const [name, board] of Object.entries(initialBoards)) {
      this.boards[name] = structuredClone(board);
      this.modified[name] = now;
    }
  }

  listNames(): string[] {
    return Object.keys(this.boards);
  }

  listEntries(): BoardEntryMeta[] {
    return Object.keys(this.boards).map((name) => ({
      name,
      modified: this.modified[name],
    }));
  }

  get(name: string): unknown | undefined {
    return name in this.boards ? this.boards[name] : undefined;
  }

  set(name: string, board: unknown): void {
    this.boards[name] = board;
    this.modified[name] = new Date().toISOString();
  }

  delete(name: string): void {
    delete this.boards[name];
    delete this.modified[name];
  }
}

export class InMemoryStateStore implements StateStore {
  remotes: Remote[];
  settings: RuntimeSettings;

  constructor(options?: {
    remotes?: Remote[];
    settings?: RuntimeSettings;
  }) {
    this.remotes = [...(options?.remotes ?? [])];
    this.settings = options?.settings
      ? {
          allowExternalRuntimeAccess: options.settings.allowExternalRuntimeAccess,
          allowedUsers: [...options.settings.allowedUsers],
        }
      : { ...DEFAULT_SETTINGS, allowedUsers: [] };
  }

  getRemotes(): Remote[] {
    return this.remotes;
  }

  setRemotes(remotes: Remote[]): void {
    this.remotes = remotes;
  }

  getSettings(): RuntimeSettings {
    return this.settings;
  }

  setSettings(settings: RuntimeSettings): void {
    this.settings = settings;
  }
}

export function boardNameFromFilePath(fileName?: string): string {
  if (!fileName) {
    return "Board";
  }
  const base = path.basename(fileName);
  const stripped = base
    .replace(/\.board\.json$/i, "")
    .replace(/\.json$/i, "")
    .replace(/\.hkpp$/i, "")
    .trim();
  return stripped || "Board";
}

/**
 * Exposes an open workspace `.board.json` document through the `hkp://boards/`
 * route family. Reading parses the document text; writing formats the updated
 * board JSON and applies a document edit when the board content changed.
 */
export class DocumentBoardStore implements BoardStore {
  private readonly fallbackName: string;
  private activeName: string;
  private modified: string = new Date().toISOString();
  private deleted = false;

  constructor(private readonly document: TextDocumentLike) {
    this.fallbackName = boardNameFromFilePath(document.fileName);
    this.activeName = this.readBoardName();
  }

  private parseDocument(): { ok: boolean; value: Record<string, unknown> } {
    const raw = this.document.getText().trim();
    if (!raw) {
      return {
        ok: false,
        value: { boardName: this.fallbackName, runtimes: [], services: {} },
      };
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { ok: true, value: parsed as Record<string, unknown> };
      }
    } catch {
      // Fall back to empty board scaffold when document is mid-edit / invalid JSON.
    }
    return {
      ok: false,
      value: { boardName: this.fallbackName, runtimes: [], services: {} },
    };
  }

  private readBoardName(): string {
    const { value } = this.parseDocument();
    if (typeof value.boardName === "string" && value.boardName.trim()) {
      return value.boardName.trim();
    }
    return this.activeName || this.fallbackName;
  }

  currentBoardName(): string {
    this.activeName = this.readBoardName();
    return this.activeName;
  }

  currentBoard(): Record<string, unknown> {
    const { value } = this.parseDocument();
    const boardName =
      typeof value.boardName === "string" && value.boardName.trim()
        ? value.boardName
        : this.currentBoardName();
    return { ...value, boardName };
  }

  listNames(): string[] {
    if (this.deleted) {
      return [];
    }
    return [this.currentBoardName()];
  }

  listEntries(): BoardEntryMeta[] {
    if (this.deleted) {
      return [];
    }
    return [{ name: this.currentBoardName(), modified: this.modified }];
  }

  get(name: string): unknown | undefined {
    if (this.deleted) {
      return undefined;
    }
    const current = this.currentBoardName();
    if (name === current || name === this.activeName || name === this.fallbackName) {
      return this.currentBoard();
    }
    return undefined;
  }

  async set(name: string, board: unknown): Promise<void> {
    this.deleted = false;
    this.modified = new Date().toISOString();
    const existing = this.parseDocument();
    const record =
      board && typeof board === "object" && !Array.isArray(board)
        ? { ...(board as Record<string, unknown>) }
        : { boardName: name, runtimes: [], services: {} };
    if (typeof record.boardName !== "string" || !record.boardName.trim()) {
      record.boardName = name || this.currentBoardName();
    }
    this.activeName = String(record.boardName);

    if (existing.ok && isDeepStrictEqual(existing.value, record)) {
      return;
    }
    const formatted = `${JSON.stringify(record, null, 2)}\n`;
    if (this.document.getText() === formatted) {
      return;
    }
    await this.document.applyEdit(formatted);
  }

  delete(name: string): void {
    const current = this.currentBoardName();
    if (name === current || name === this.activeName || name === this.fallbackName) {
      this.deleted = true;
    }
  }
}

function jsonResponse(body: unknown, status = 200): HkpResponsePayload {
  return {
    status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function emptyResponse(status = 200): HkpResponsePayload {
  return {
    status,
    headers: {},
    body: null,
  };
}

function notFoundResponse(): HkpResponsePayload {
  return {
    status: 404,
    headers: { "Content-Type": "text/plain" },
    body: "not found",
  };
}

function parseBody(body: unknown): unknown {
  if (body === undefined || body === null) {
    return undefined;
  }
  if (typeof body === "string") {
    if (!body.length) {
      return undefined;
    }
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  return body;
}

export interface HkpRouterOptions {
  boards?: BoardStore;
  state?: StateStore;
  onRemotesChanged?: (remotes: Remote[]) => void;
}

export interface HkpRouter {
  readonly boards: BoardStore;
  readonly state: StateStore;
  readonly calls: Array<{ method: string; url: string; body?: unknown }>;
  handle(request: HkpRequest): Promise<HkpResponsePayload>;
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

export function createHkpRouter(options: HkpRouterOptions = {}): HkpRouter {
  const boards = options.boards ?? new InMemoryBoardStore();
  const state = options.state ?? new InMemoryStateStore();
  const calls: Array<{ method: string; url: string; body?: unknown }> = [];

  const handle = async (request: HkpRequest): Promise<HkpResponsePayload> => {
    const method = (request.method ?? "GET").toUpperCase();
    const body = parseBody(request.body);
    if (method !== "GET") {
      calls.push({ method, url: request.url, body });
    }

    if (!request.url.startsWith("hkp://")) {
      return notFoundResponse();
    }

    // Hand-parsed rather than via `new URL`: `hkp://` is a non-special scheme
    // and engines disagree on how its authority and path split.
    const rest = request.url.slice("hkp://".length);
    const [pathPart, queryPart = ""] = rest.split("?");
    const segments = pathPart.split("/");
    const root = segments[0];
    const tail = decodeURIComponent(segments.slice(1).join("/"));
    const query = new URLSearchParams(queryPart);

    if (root === "boards") {
      if (!tail) {
        if (query.get("meta")) {
          const entries = await boards.listEntries();
          return jsonResponse(
            entries.map((entry) => ({
              name: encodeURIComponent(entry.name),
              modified: entry.modified,
            })),
          );
        }
        const names = await boards.listNames();
        return jsonResponse(names.map((name) => encodeURIComponent(name)));
      }
      if (method === "GET") {
        const board = await boards.get(tail);
        return board !== undefined ? jsonResponse(board) : notFoundResponse();
      }
      if (method === "POST") {
        await boards.set(tail, body);
        return emptyResponse();
      }
      if (method === "DELETE") {
        await boards.delete(tail);
        return emptyResponse();
      }
    }

    if (root === "remotes") {
      if (method === "GET") {
        return jsonResponse(await state.getRemotes());
      }
      if (method === "POST") {
        const saved = body as { name?: string } | Remote[] | undefined;
        if (Array.isArray(saved)) {
          await state.setRemotes(saved);
          options.onRemotesChanged?.(saved);
        } else if (saved && typeof saved.name === "string") {
          const current = await state.getRemotes();
          const kept = current.filter((remote) => remote.name !== saved.name);
          const next = [...kept, saved as Remote];
          await state.setRemotes(next);
          options.onRemotesChanged?.(next);
        }
        return emptyResponse();
      }
      if (method === "DELETE") {
        const named = (body as { name?: string } | undefined)?.name;
        const current = await state.getRemotes();
        const next = current.filter((remote) => remote.name !== named);
        await state.setRemotes(next);
        options.onRemotesChanged?.(next);
        return emptyResponse();
      }
    }

    if (root === "settings") {
      if (method === "GET") {
        return jsonResponse(await state.getSettings());
      }
      if (method === "POST") {
        const current = await state.getSettings();
        const updated: RuntimeSettings = {
          ...current,
          ...(body && typeof body === "object"
            ? (body as Partial<RuntimeSettings>)
            : {}),
        };
        await state.setSettings(updated);
        return jsonResponse(updated);
      }
    }

    return notFoundResponse();
  };

  const fetchAdapter = async (url: string, init: RequestInit = {}): Promise<Response> => {
    let body: unknown = init.body;
    if (body instanceof ArrayBuffer) {
      body = new TextDecoder().decode(new Uint8Array(body));
    } else if (ArrayBuffer.isView(body)) {
      body = new TextDecoder().decode(
        new Uint8Array(body.buffer, body.byteOffset, body.byteLength),
      );
    }
    const headers: Record<string, string> = {};
    if (init.headers) {
      new Headers(init.headers).forEach((value, key) => {
        headers[key] = value;
      });
    }
    const reply = await handle({
      url,
      method: init.method ?? "GET",
      headers,
      body,
    });
    return new Response(reply.body, {
      status: reply.status,
      headers: reply.headers,
    });
  };

  return {
    boards,
    state,
    calls,
    handle,
    fetch: fetchAdapter,
  };
}
