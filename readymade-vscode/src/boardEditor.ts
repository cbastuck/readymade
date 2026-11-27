import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildWebviewHtml } from "./csp.js";
import {
  createHkpRouter,
  DocumentBoardStore,
  type HkpRouter,
} from "./router.js";
import type {
  Remote,
  RuntimeSettings,
  StateStore,
  TextDocumentLike,
  Thenable,
  WebviewFetchMessage,
  WebviewMessage,
} from "./types.js";

export const REMOTES_STATE_KEY = "readymade.remotes";
export const SETTINGS_STATE_KEY = "readymade.settings";

const DEFAULT_REMOTES: Remote[] = [
  { name: "node", url: "http://127.0.0.1:8080", port: 8080 },
  { name: "python", url: "http://127.0.0.1:8081", port: 8081 },
];

const DEFAULT_SETTINGS: RuntimeSettings = {
  allowExternalRuntimeAccess: false,
  allowedUsers: [],
};

export interface MementoLike {
  get<T>(key: string, defaultValue?: T): T | undefined;
  update(key: string, value: unknown): Thenable<void> | Promise<void>;
}

export class GlobalStateStore implements StateStore {
  constructor(
    private readonly globalState: MementoLike,
    private readonly defaultRemotes: Remote[] = DEFAULT_REMOTES,
  ) {}

  getRemotes(): Remote[] {
    const saved = this.globalState.get<Remote[]>(REMOTES_STATE_KEY);
    return Array.isArray(saved) ? saved : [...this.defaultRemotes];
  }

  async setRemotes(remotes: Remote[]): Promise<void> {
    await this.globalState.update(REMOTES_STATE_KEY, remotes);
  }

  getSettings(): RuntimeSettings {
    const saved = this.globalState.get<RuntimeSettings>(SETTINGS_STATE_KEY);
    return saved && typeof saved === "object"
      ? {
          allowExternalRuntimeAccess: Boolean(saved.allowExternalRuntimeAccess),
          allowedUsers: Array.isArray(saved.allowedUsers)
            ? [...saved.allowedUsers]
            : [],
        }
      : { ...DEFAULT_SETTINGS, allowedUsers: [] };
  }

  async setSettings(settings: RuntimeSettings): Promise<void> {
    await this.globalState.update(SETTINGS_STATE_KEY, settings);
  }
}

export interface WebviewLike {
  readonly cspSource: string;
  html: string;
  options: {
    enableScripts?: boolean;
    localResourceRoots?: unknown[];
  };
  asWebviewUri(relativePath: string): string;
  postMessage(message: WebviewMessage): Thenable<boolean> | Promise<boolean>;
  onDidReceiveMessage(
    listener: (message: unknown) => unknown,
  ): { dispose(): void };
}

export interface BoardEditorSessionOptions {
  document: TextDocumentLike;
  webview: WebviewLike;
  stateStore: StateStore;
  templateHtml: string;
}

export interface BoardEditorSession {
  readonly router: HkpRouter;
  readonly boardStore: DocumentBoardStore;
  notifyExternalDocumentChange(): void;
  dispose(): void;
}

/**
 * Connects one open `.board.json` document to one custom-editor webview.
 *
 * Kept free of a direct `vscode` module import so the full custom-editor flow
 * (initial HTML + CSP, `hkp://` message routing, and document writeback on
 * playground edits) can run in unit and integration tests without booting the
 * VS Code binary.
 */
export function createBoardEditorSession(
  options: BoardEditorSessionOptions,
): BoardEditorSession {
  const boardStore = new DocumentBoardStore(options.document);
  const router = createHkpRouter({
    boards: boardStore,
    state: options.stateStore,
  });

  const renderHtml = async () => {
    const remotes = await options.stateStore.getRemotes();
    options.webview.html = buildWebviewHtml({
      templateHtml: options.templateHtml,
      cspSource: options.webview.cspSource,
      boardName: boardStore.currentBoardName(),
      board: boardStore.currentBoard(),
      remotes,
      asWebviewUri: (rel) => options.webview.asWebviewUri(rel),
    });
  };

  void renderHtml();

  const messageSubscription = options.webview.onDidReceiveMessage(
    async (rawMessage: unknown) => {
      if (!rawMessage || typeof rawMessage !== "object") {
        return;
      }
      const message = rawMessage as Partial<WebviewFetchMessage>;
      if (message.type !== "hkp-fetch" || typeof message.requestId !== "string" || typeof message.url !== "string") {
        return;
      }
      const response = await router.handle({
        url: message.url,
        method: message.method ?? "GET",
        headers: message.headers,
        body: message.body ?? undefined,
      });
      await options.webview.postMessage({
        type: "hkp-fetch-response",
        requestId: message.requestId,
        status: response.status,
        headers: response.headers,
        body: response.body,
      });
    },
  );

  const notifyExternalDocumentChange = () => {
    const raw = options.document.getText().trim();
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        void options.webview.postMessage({
          type: "hkp-document-changed",
          board: parsed,
        });
      }
    } catch {
      // Ignore intermediate invalid JSON while the user is typing in the text buffer.
    }
  };

  return {
    router,
    boardStore,
    notifyExternalDocumentChange,
    dispose: () => {
      messageSubscription.dispose();
    },
  };
}

/**
 * Locates the built frontend bundle directory (`index.html` + `assets/`).
 * Prefers `dist/webapp` inside the extension and falls back to sibling builds
 * in a workspace checkout.
 */
export function resolveWebAppDir(extensionPath: string): string {
  const candidates = [
    path.join(extensionPath, "dist", "webapp"),
    path.resolve(extensionPath, "../meander/frontend/dist"),
    path.resolve(
      extensionPath,
      "../meander-android/app/src/main/assets/WebApp",
    ),
    path.resolve(
      extensionPath,
      "../meander-ios/ReadymadeIOS/Resources/WebApp",
    ),
  ];
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "index.html"))) {
      return candidate;
    }
  }
  return candidates[0];
}

export function loadTemplateHtml(webAppDir: string): string {
  const indexPath = path.join(webAppDir, "index.html");
  if (existsSync(indexPath)) {
    return readFileSync(indexPath, "utf8");
  }
  return `<!doctype html>
<html lang="en" style="height: 100%; width: 100%">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Readymade</title>
  </head>
  <body style="height: 100%; width: 100%">
    <div id="root" style="height: 100%; width: 100%"></div>
  </body>
</html>`;
}
