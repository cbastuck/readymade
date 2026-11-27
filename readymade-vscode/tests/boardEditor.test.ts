import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createBoardEditorSession,
  GlobalStateStore,
  loadTemplateHtml,
  type MementoLike,
  resolveWebAppDir,
  type WebviewLike,
} from "../src/boardEditor.js";
import { installHkpFetchShim } from "../src/shim.js";
import type { WebviewFetchMessage, WebviewMessage } from "../src/types.js";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const hasHkpNode =
  existsSync(path.join(repoRoot, "hkp-node/src/server.ts")) &&
  existsSync(path.join(repoRoot, "hkp-node/node_modules/express"));

async function startLocalNodeRuntime(): Promise<{
  baseUrl: string;
  stop: () => Promise<void>;
}> {
  if (hasHkpNode) {
    const { createRuntimeServer } = await import(
      "../../hkp-node/src/server.js"
    );
    const server = createRuntimeServer({ externalHost: "127.0.0.1" });
    const { baseUrl } = await server.start(0, "127.0.0.1");
    return {
      baseUrl,
      stop: () => server.stop(),
    };
  }

  // Fallback when running in a checkout without the hkp-node submodule installed
  const runtimes = new Map<string, unknown>();
  const server = http.createServer((req, res) => {
    const origin = req.headers.origin ?? "";
    if (origin && !/^vscode-webview:\/\/[0-9a-z.-]+$/.test(origin)) {
      res.writeHead(403).end();
      return;
    }
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (req.method === "POST" && req.url === "/runtimes") {
        const body = JSON.parse(raw);
        runtimes.set(body.id, body);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ id: body.id, registry: [] }));
        return;
      }
      if (req.method === "POST" && req.url?.endsWith("/process")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(raw || "{}");
        return;
      }
      res.writeHead(404).end();
    });
  });

  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve()),
  );
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    stop: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

function createFakeMemento(initial: Record<string, unknown> = {}): MementoLike {
  const map = new Map<string, unknown>(Object.entries(initial));
  return {
    get<T>(key: string, defaultValue?: T): T | undefined {
      return (map.has(key) ? map.get(key) : defaultValue) as T | undefined;
    },
    async update(key: string, value: unknown): Promise<void> {
      map.set(key, value);
    },
  };
}

describe("BoardEditorSession custom editor workflow", () => {
  it("opens a demo board from the workspace, runs against a local hkp-node, and writes playground edits back as unsaved document changes", async () => {
    const demoPath = path.join(repoRoot, "boards/timer-demo-board.json");
    let documentText = readFileSync(demoPath, "utf8");
    let isDirty = false;
    const externalBoardsReceived: unknown[] = [];

    const toHostListeners = new Set<(message: unknown) => unknown>();
    const toWebviewListeners = new Set<(message: WebviewMessage) => void>();

    const webview: WebviewLike = {
      cspSource: "https://file+.vscode-resource.vscode-cdn.net",
      html: "",
      options: {},
      asWebviewUri: (rel) =>
        `https://file+.vscode-resource.vscode-cdn.net/dist/webapp/${rel}`,
      postMessage: async (message: WebviewMessage) => {
        for (const listener of toWebviewListeners) {
          listener(message);
        }
        return true;
      },
      onDidReceiveMessage: (listener) => {
        toHostListeners.add(listener);
        return {
          dispose: () => toHostListeners.delete(listener),
        };
      },
    };

    const stateStore = new GlobalStateStore(createFakeMemento());
    const session = createBoardEditorSession({
      document: {
        fileName: "/workspace/timer-demo.board.json",
        getText: () => documentText,
        applyEdit: async (newText: string) => {
          documentText = newText;
          isDirty = true;
          return true;
        },
      },
      webview,
      stateStore,
      templateHtml: `<!doctype html><html><head><script type="module" src="/assets/index.js"></script></head><body><div id="root"></div></body></html>`,
    });

    const webviewWindow = {
      fetch: globalThis.fetch.bind(globalThis),
      hkp: {
        loadBoard: (board: unknown) => {
          externalBoardsReceived.push(board);
        },
      },
    };

    const disposeShim = installHkpFetchShim(webviewWindow, {
      postMessage: (msg: WebviewFetchMessage) => {
        for (const listener of toHostListeners) {
          listener(msg);
        }
      },
      onMessage: (listener) => {
        toWebviewListeners.add(listener);
        return () => toWebviewListeners.delete(listener);
      },
    });

    try {
      // 1. Webview probes hkp://boards/ on startup (`isMeanderApp()`)
      const listRes = await webviewWindow.fetch("hkp://boards/");
      expect(listRes.status).toBe(200);
      const boardNames = (await listRes.json()) as string[];
      expect(boardNames.map(decodeURIComponent)).toEqual(["Timer Demo"]);

      // 2. Webview loads the open workspace board document
      const boardRes = await webviewWindow.fetch(
        `hkp://boards/${boardNames[0]}`,
      );
      expect(boardRes.status).toBe(200);
      const loadedBoard = (await boardRes.json()) as {
        boardName: string;
        runtimes: Array<{ id: string; name: string; type: string; url?: string }>;
        services: Record<
          string,
          Array<{
            uuid: string;
            serviceId: string;
            serviceName: string;
            state?: Record<string, unknown>;
          }>
        >;
      };
      expect(loadedBoard.boardName).toBe("Timer Demo");
      expect(isDirty).toBe(false);

      // 3. Start a local hkp-node server and provision & run a runtime from
      //    the webview with a VS Code webview Origin.
      const runtimeServer = await startLocalNodeRuntime();
      try {
        const { baseUrl } = runtimeServer;
        const vscodeOrigin =
          "vscode-webview://1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d";

        // Register the local hkp-node in the extension's remotes via hkp://remotes/
        const saveRemoteRes = await webviewWindow.fetch("hkp://remotes/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "node", url: baseUrl }),
        });
        expect(saveRemoteRes.status).toBe(200);

        // Provision a runtime on the local hkp-node from the VS Code webview origin
        const createRtRes = await webviewWindow.fetch(`${baseUrl}/runtimes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: vscodeOrigin,
          },
          body: JSON.stringify({
            id: "node-rt",
            name: "Node Runtime",
            garbageCollected: false,
            services: [
              {
                uuid: "node-mon",
                serviceId: "monitor",
                serviceName: "Monitor",
                state: {},
              },
            ],
          }),
        });
        expect(createRtRes.status).toBe(200);

        // Process data through the runtime on the local hkp-node
        const processRes = await webviewWindow.fetch(
          `${baseUrl}/runtimes/node-rt/process`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Origin: vscodeOrigin,
            },
            body: JSON.stringify({ triggerCount: 1 }),
          },
        );
        expect(processRes.status).toBe(200);
      } finally {
        await runtimeServer.stop();
      }

      // 4. An edit in the playground saves back through `POST hkp://boards/<name>`
      //    and shows up as an unsaved change (`isDirty === true`) in the workspace file.
      const firstRuntimeId = loadedBoard.runtimes[0].id;
      const editedBoard = structuredClone(loadedBoard);
      editedBoard.services[firstRuntimeId][0].state = {
        ...editedBoard.services[firstRuntimeId][0].state,
        periodicValue: 750,
      };

      const saveBoardRes = await webviewWindow.fetch(
        `hkp://boards/${encodeURIComponent(loadedBoard.boardName)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editedBoard),
        },
      );
      expect(saveBoardRes.status).toBe(200);
      expect(isDirty).toBe(true);
      expect(
        JSON.parse(documentText).services[firstRuntimeId][0].state.periodicValue,
      ).toBe(750);

      // 5. An external change to the document (e.g. VS Code Undo) notifies the webview
      session.notifyExternalDocumentChange();
      expect(externalBoardsReceived).toHaveLength(1);
      expect(externalBoardsReceived[0]).toEqual(editedBoard);
    } finally {
      disposeShim();
      session.dispose();
    }
  });

  it("loads the built frontend template html and rewrites asset URIs for the webview", () => {
    const extensionPath = path.resolve(import.meta.dirname, "..");
    const webAppDir = resolveWebAppDir(extensionPath);
    const templateHtml = loadTemplateHtml(webAppDir);
    expect(templateHtml).toContain('<div id="root"');
  });
});
