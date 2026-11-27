import { describe, expect, it } from "vitest";
import {
  installFakeNativeHost,
  type FakeHostConfig,
} from "../../e2e/support/fakeNativeHost.js";
import {
  createHkpRouter,
  DocumentBoardStore,
  InMemoryBoardStore,
  InMemoryStateStore,
} from "../src/router.js";
import { installHkpFetchShim, type MessageBridge } from "../src/shim.js";
import type {
  Remote,
  RuntimeSettings,
  WebviewFetchMessage,
  WebviewMessage,
} from "../src/types.js";

type HostDriver = {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
};

function createFakeNativeHostDriver(config: Omit<FakeHostConfig, "shell"> = {}): HostDriver {
  const storage = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  };

  const fakeWindow: Record<string, unknown> = {
    location: { protocol: "http:" },
    localStorage: localStorageMock,
    fetch: globalThis.fetch.bind(globalThis),
  };
  fakeWindow.top = fakeWindow;

  Object.defineProperty(globalThis, "window", {
    value: fakeWindow,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "location", {
    value: fakeWindow.location,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageMock,
    configurable: true,
    writable: true,
  });
  installFakeNativeHost({ shell: "desktop", ...config });
  return {
    fetch: fakeWindow.fetch as (url: string, init?: RequestInit) => Promise<Response>,
  };
}

function createRouterDriver(config: Omit<FakeHostConfig, "shell"> = {}): HostDriver {
  const router = createHkpRouter({
    boards: new InMemoryBoardStore(config.boards),
    state: new InMemoryStateStore({
      remotes: config.remotes as Remote[] | undefined,
      settings: config.settings as RuntimeSettings | undefined,
    }),
  });
  return {
    fetch: (url, init) => router.fetch(url, init),
  };
}

function createShimOverPostMessageDriver(
  config: Omit<FakeHostConfig, "shell"> = {},
): HostDriver {
  const router = createHkpRouter({
    boards: new InMemoryBoardStore(config.boards),
    state: new InMemoryStateStore({
      remotes: config.remotes as Remote[] | undefined,
      settings: config.settings as RuntimeSettings | undefined,
    }),
  });

  const listeners = new Set<(message: WebviewMessage) => void>();
  const bridge: MessageBridge = {
    postMessage: (message: WebviewFetchMessage) => {
      void router
        .handle({
          url: message.url,
          method: message.method,
          headers: message.headers,
          body: message.body ?? undefined,
        })
        .then((reply) => {
          const responseMsg: WebviewMessage = {
            type: "hkp-fetch-response",
            requestId: message.requestId,
            status: reply.status,
            headers: reply.headers,
            body: reply.body,
          };
          for (const listener of listeners) {
            listener(responseMsg);
          }
        });
    },
    onMessage: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  const target = {
    fetch: globalThis.fetch.bind(globalThis),
  };
  installHkpFetchShim(target, bridge);

  return {
    fetch: (url, init) => target.fetch(url, init),
  };
}

/**
 * Runs the shared `hkp://` route contract against both `e2e/support/fakeNativeHost.ts`
 * and the VS Code extension's router + webview `postMessage` shim (T1 in
 * `plans/architectural-tradeoffs.md`).
 */
describe.each([
  ["e2e fakeNativeHost", createFakeNativeHostDriver],
  ["readymade-vscode HkpRouter", createRouterDriver],
  ["readymade-vscode fetch shim + postMessage", createShimOverPostMessageDriver],
])("hkp:// route contract (%s)", (_label, makeDriver) => {
  it("lists, loads, saves, and deletes boards with special characters decoded once", async () => {
    const initialBoard = {
      boardName: "Initial",
      runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
      services: { ui: [] },
    };
    const host = makeDriver({ boards: { Initial: initialBoard } });

    const listRes = await host.fetch("hkp://boards/");
    expect(listRes.status).toBe(200);
    expect(await listRes.json()).toEqual(["Initial"]);

    const metaRes = await host.fetch("hkp://boards/?meta=1");
    expect(metaRes.status).toBe(200);
    const meta = (await metaRes.json()) as Array<{ name: string; modified: string }>;
    expect(meta).toHaveLength(1);
    expect(meta[0].name).toBe("Initial");
    expect(typeof meta[0].modified).toBe("string");

    const loadRes = await host.fetch("hkp://boards/Initial");
    expect(loadRes.status).toBe(200);
    expect(await loadRes.json()).toEqual(initialBoard);

    // Percent-encoded board name with spaces, slashes, percent, plus and accents
    // (guards against the double-decode regression noted in architectural-tradeoffs.md T1).
    const trickyName = "Audio / Synth 100% + Café";
    const encodedName = encodeURIComponent(trickyName);
    const trickyBoard = {
      boardName: trickyName,
      runtimes: [],
      services: {},
    };

    const saveRes = await host.fetch(`hkp://boards/${encodedName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trickyBoard),
    });
    expect(saveRes.status).toBe(200);

    const listAfterSave = (await (await host.fetch("hkp://boards/")).json()) as string[];
    expect(listAfterSave.map(decodeURIComponent)).toEqual(["Initial", trickyName]);

    const getTricky = await host.fetch(`hkp://boards/${encodedName}`);
    expect(getTricky.status).toBe(200);
    expect(await getTricky.json()).toEqual(trickyBoard);

    const deleteRes = await host.fetch(`hkp://boards/${encodedName}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(200);

    const getDeleted = await host.fetch(`hkp://boards/${encodedName}`);
    expect(getDeleted.status).toBe(404);
  });

  it("reads, upserts by name, replaces, and deletes remotes", async () => {
    const host = makeDriver({
      remotes: [{ name: "node", url: "http://127.0.0.1:8080", port: 8080 }],
    });

    const initial = await (await host.fetch("hkp://remotes/")).json();
    expect(initial).toEqual([
      { name: "node", url: "http://127.0.0.1:8080", port: 8080 },
    ]);

    // Add a second remote
    const addRes = await host.fetch("hkp://remotes/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "python",
        url: "http://127.0.0.1:8081",
        port: 8081,
      }),
    });
    expect(addRes.status).toBe(200);

    // Update existing remote by name
    const updateRes = await host.fetch("hkp://remotes/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "node",
        url: "http://127.0.0.1:9090",
        port: 9090,
      }),
    });
    expect(updateRes.status).toBe(200);

    const afterUpdate = await (await host.fetch("hkp://remotes/")).json();
    expect(afterUpdate).toEqual([
      { name: "python", url: "http://127.0.0.1:8081", port: 8081 },
      { name: "node", url: "http://127.0.0.1:9090", port: 9090 },
    ]);

    // Delete by name
    const delRes = await host.fetch("hkp://remotes/", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "python" }),
    });
    expect(delRes.status).toBe(200);

    const afterDelete = await (await host.fetch("hkp://remotes/")).json();
    expect(afterDelete).toEqual([
      { name: "node", url: "http://127.0.0.1:9090", port: 9090 },
    ]);
  });

  it("reads and patches runtime settings", async () => {
    const host = makeDriver();

    const getRes = await host.fetch("hkp://settings");
    expect(getRes.status).toBe(200);
    expect(await getRes.json()).toEqual({
      allowExternalRuntimeAccess: false,
      allowedUsers: [],
    });

    const postRes = await host.fetch("hkp://settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        allowExternalRuntimeAccess: true,
        allowedUsers: ["builder@example.com"],
      }),
    });
    expect(postRes.status).toBe(200);
    expect(await postRes.json()).toEqual({
      allowExternalRuntimeAccess: true,
      allowedUsers: ["builder@example.com"],
    });

    const getAfter = await host.fetch("hkp://settings");
    expect(await getAfter.json()).toEqual({
      allowExternalRuntimeAccess: true,
      allowedUsers: ["builder@example.com"],
    });
  });

  it("returns 404 for unknown hkp:// route families", async () => {
    const host = makeDriver();
    const res = await host.fetch("hkp://unknown-family/item");
    expect(res.status).toBe(404);
  });
});

describe("DocumentBoardStore", () => {
  it("serves the open document and writes edits back only when the board changed", async () => {
    const initialBoard = {
      boardName: "Timer Demo",
      runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
      services: {
        ui: [
          {
            uuid: "t1",
            serviceId: "hookup.to/service/timer",
            serviceName: "Timer",
            state: { periodic: true, periodicValue: 1, periodicUnit: "s" },
          },
        ],
      },
    };
    let text = JSON.stringify(initialBoard, null, 2);
    let editCount = 0;

    const store = new DocumentBoardStore({
      fileName: "/workspace/timer-demo.board.json",
      getText: () => text,
      applyEdit: async (newText: string) => {
        text = newText;
        editCount += 1;
        return true;
      },
    });

    const router = createHkpRouter({ boards: store });

    // Listing returns the open document's board name
    expect(await (await router.fetch("hkp://boards/")).json()).toEqual([
      "Timer%20Demo",
    ]);

    // Posting an identical board does not dirty the file
    await router.fetch("hkp://boards/Timer%20Demo", {
      method: "POST",
      body: JSON.stringify(initialBoard),
    });
    expect(editCount).toBe(0);

    // Editing a service state writes the formatted board to the open document
    const editedBoard = {
      ...initialBoard,
      services: {
        ui: [
          {
            ...initialBoard.services.ui[0],
            state: { periodic: true, periodicValue: 250, periodicUnit: "ms" },
          },
        ],
      },
    };
    const saveRes = await router.fetch("hkp://boards/Timer%20Demo", {
      method: "POST",
      body: JSON.stringify(editedBoard),
    });
    expect(saveRes.status).toBe(200);
    expect(editCount).toBe(1);
    expect(JSON.parse(text)).toEqual(editedBoard);
  });
});
