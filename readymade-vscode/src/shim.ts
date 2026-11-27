import type {
  WebviewDocumentChangedMessage,
  WebviewFetchMessage,
  WebviewFetchResponseMessage,
  WebviewMessage,
} from "./types.js";

export interface MessageBridge {
  postMessage(message: WebviewFetchMessage): void;
  onMessage(listener: (message: WebviewMessage) => void): () => void;
}

export interface FetchShimTarget {
  fetch: typeof globalThis.fetch;
  hkp?: {
    loadBoard?: (board: unknown) => Promise<void> | void;
  };
}

async function readInitBody(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<string | null> {
  const rawBody = init?.body;
  if (rawBody != null) {
    if (typeof rawBody === "string") {
      return rawBody;
    }
    if (rawBody instanceof ArrayBuffer) {
      return new TextDecoder().decode(new Uint8Array(rawBody));
    }
    if (ArrayBuffer.isView(rawBody)) {
      return new TextDecoder().decode(
        new Uint8Array(rawBody.buffer, rawBody.byteOffset, rawBody.byteLength),
      );
    }
    if (typeof Blob !== "undefined" && rawBody instanceof Blob) {
      return await rawBody.text();
    }
    return String(rawBody);
  }
  if (typeof Request !== "undefined" && input instanceof Request) {
    const method = (init?.method || input.method || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      return await input.text();
    }
  }
  return null;
}

function readInitHeaders(
  input: RequestInfo | URL,
  init?: RequestInit,
): Record<string, string> {
  const out: Record<string, string> = {};
  const source =
    init?.headers ??
    (typeof Request !== "undefined" && input instanceof Request
      ? input.headers
      : undefined);
  if (source) {
    new Headers(source).forEach((value, key) => {
      out[key] = value;
    });
  }
  return out;
}

/**
 * Installs the `hkp://` `window.fetch` shim in a webview environment and wires
 * document-change messages from the extension host to `window.hkp.loadBoard`.
 */
export function installHkpFetchShim(
  target: FetchShimTarget,
  bridge: MessageBridge,
): () => void {
  const originalFetch = target.fetch.bind(target);
  let nextId = 1;
  const pending = new Map<
    string,
    {
      resolve: (response: Response) => void;
      reject: (error: Error) => void;
    }
  >();

  const unsubscribe = bridge.onMessage((message: WebviewMessage) => {
    if (!message || typeof message !== "object") {
      return;
    }
    if (message.type === "hkp-fetch-response") {
      const reply = message as WebviewFetchResponseMessage;
      const entry = pending.get(reply.requestId);
      if (!entry) {
        return;
      }
      pending.delete(reply.requestId);
      entry.resolve(
        new Response(reply.body, {
          status: reply.status,
          headers: reply.headers ?? {},
        }),
      );
      return;
    }
    if (message.type === "hkp-document-changed") {
      const changed = message as WebviewDocumentChangedMessage;
      if (changed.board && target.hkp?.loadBoard) {
        void target.hkp.loadBoard(changed.board);
      }
    }
  });

  target.fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (!String(url).startsWith("hkp://")) {
      return originalFetch(input as RequestInfo, init);
    }

    const method = (
      init?.method ||
      (typeof Request !== "undefined" && input instanceof Request
        ? input.method
        : "GET")
    ).toUpperCase();
    const headers = readInitHeaders(input, init);
    const body = await readInitBody(input, init);
    const requestId = `hkp-req-${nextId++}`;

    return new Promise<Response>((resolve, reject) => {
      if (init?.signal?.aborted) {
        reject(new DOMException("The operation was aborted.", "AbortError"));
        return;
      }
      const onAbort = () => {
        if (pending.delete(requestId)) {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        }
      };
      init?.signal?.addEventListener("abort", onAbort, { once: true });

      pending.set(requestId, {
        resolve: (res) => {
          init?.signal?.removeEventListener("abort", onAbort);
          resolve(res);
        },
        reject: (err) => {
          init?.signal?.removeEventListener("abort", onAbort);
          reject(err);
        },
      });

      bridge.postMessage({
        type: "hkp-fetch",
        requestId,
        url: String(url),
        method,
        headers,
        body,
      });
    });
  }) as typeof globalThis.fetch;

  return () => {
    unsubscribe();
    target.fetch = originalFetch;
    for (const [, entry] of pending) {
      entry.reject(new Error("HKP fetch shim disposed"));
    }
    pending.clear();
  };
}

/**
 * Self-contained init script injected into the VS Code webview `<head>` before
 * any application module evaluates.
 */
export function buildHkpShimScript(options: { boardName: string }): string {
  const boardNameLiteral = JSON.stringify(options.boardName);
  return `(() => {
  if (window !== window.top) return;
  const vscode = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : null;
  window.__MEANDER_VSCODE__ = true;
  window.__MEANDER_INITIAL_BOARD_NAME__ = ${boardNameLiteral};
  try {
    window.localStorage.setItem("lastActiveBoardName", ${boardNameLiteral});
    window.localStorage.setItem("lastActiveBoardLibrary", "local");
  } catch {}
  try {
    if (window.location.pathname !== "/playground") {
      window.history.replaceState(null, "", "/playground");
    }
  } catch {}

  if (!vscode) return;

  const originalFetch = window.fetch.bind(window);
  let nextId = 1;
  const pending = new Map();

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || typeof message !== "object") return;
    if (message.type === "hkp-fetch-response") {
      const entry = pending.get(message.requestId);
      if (!entry) return;
      pending.delete(message.requestId);
      entry.resolve(
        new Response(message.body, {
          status: message.status,
          headers: message.headers || {},
        }),
      );
      return;
    }
    if (message.type === "hkp-document-changed") {
      if (message.board && window.hkp && typeof window.hkp.loadBoard === "function") {
        window.hkp.loadBoard(message.board);
      }
    }
  });

  const readBody = async (input, init) => {
    const rawBody = init && init.body;
    if (rawBody != null) {
      if (typeof rawBody === "string") return rawBody;
      if (rawBody instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(rawBody));
      if (ArrayBuffer.isView(rawBody)) {
        return new TextDecoder().decode(new Uint8Array(rawBody.buffer, rawBody.byteOffset, rawBody.byteLength));
      }
      if (typeof Blob !== "undefined" && rawBody instanceof Blob) return await rawBody.text();
      return String(rawBody);
    }
    if (typeof Request !== "undefined" && input instanceof Request) {
      const method = ((init && init.method) || input.method || "GET").toUpperCase();
      if (method !== "GET" && method !== "HEAD") return await input.text();
    }
    return null;
  };

  const readHeaders = (input, init) => {
    const out = {};
    const source = (init && init.headers) || (typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    if (source) {
      new Headers(source).forEach((value, key) => { out[key] = value; });
    }
    return out;
  };

  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!String(url).startsWith("hkp://")) {
      return originalFetch(input, init);
    }
    const method = (init.method || (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase();
    const headers = readHeaders(input, init);
    const body = await readBody(input, init);
    const requestId = "hkp-req-" + (nextId++);
    return new Promise((resolve, reject) => {
      if (init.signal && init.signal.aborted) {
        reject(new DOMException("The operation was aborted.", "AbortError"));
        return;
      }
      const onAbort = () => {
        if (pending.delete(requestId)) {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        }
      };
      if (init.signal) init.signal.addEventListener("abort", onAbort, { once: true });
      pending.set(requestId, {
        resolve: (res) => {
          if (init.signal) init.signal.removeEventListener("abort", onAbort);
          resolve(res);
        },
        reject: (err) => {
          if (init.signal) init.signal.removeEventListener("abort", onAbort);
          reject(err);
        },
      });
      vscode.postMessage({
        type: "hkp-fetch",
        requestId,
        url: String(url),
        method,
        headers,
        body,
      });
    });
  };
})();`;
}
