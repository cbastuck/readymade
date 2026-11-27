import { randomBytes } from "node:crypto";
import { buildHkpShimScript } from "./shim.js";
import type { Remote } from "./types.js";

const LOOPBACK_CONNECT_SOURCES = [
  "http://127.0.0.1:*",
  "http://localhost:*",
  "ws://127.0.0.1:*",
  "ws://localhost:*",
];

function addUrlOrigins(rawUrl: string, port: number | undefined, target: Set<string>): void {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith("hkp://")) {
    return;
  }
  const normalized = trimmed.replace(/HKP_RUNTIME_HOST/g, "127.0.0.1");
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return;
  }

  const addForHost = (protocol: string, host: string) => {
    if (protocol === "http:" || protocol === "https:") {
      const wsProtocol = protocol === "https:" ? "wss:" : "ws:";
      target.add(`${protocol}//${host}`);
      target.add(`${wsProtocol}//${host}`);
    } else if (protocol === "ws:" || protocol === "wss:") {
      const httpProtocol = protocol === "wss:" ? "https:" : "http:";
      target.add(`${httpProtocol}//${host}`);
      target.add(`${protocol}//${host}`);
    }
  };

  addForHost(parsed.protocol, parsed.host);
  if (port && port > 0 && !parsed.port) {
    addForHost(parsed.protocol, `${parsed.hostname}:${port}`);
  }
}

/**
 * Extracts HTTP(S) and WS(S) `connect-src` origins for every remote runtime a
 * board names (directly by `url`, or by `remote` resolved against `remotes`)
 * alongside the host's configured remotes and loopback runtime ports.
 */
export function extractRuntimeConnectSources(
  board: unknown,
  remotes: readonly Remote[] = [],
): string[] {
  const sources = new Set<string>(LOOPBACK_CONNECT_SOURCES);

  for (const remote of remotes) {
    if (remote && typeof remote.url === "string") {
      addUrlOrigins(remote.url, remote.port, sources);
    }
  }

  if (board && typeof board === "object" && !Array.isArray(board)) {
    const runtimes = (board as { runtimes?: unknown }).runtimes;
    if (Array.isArray(runtimes)) {
      for (const entry of runtimes) {
        if (!entry || typeof entry !== "object") {
          continue;
        }
        const rt = entry as { url?: unknown; remote?: unknown };
        if (typeof rt.url === "string") {
          if (rt.url.startsWith("hkp://remotes/")) {
            const legacyName = rt.url.slice("hkp://remotes/".length).split("/")[0];
            const match = remotes.find(
              (r) => r.name === legacyName || r.aliases?.includes(legacyName),
            );
            if (match) {
              addUrlOrigins(match.url, match.port, sources);
            }
          } else {
            addUrlOrigins(rt.url, undefined, sources);
          }
        }
        if (typeof rt.remote === "string") {
          const remoteName = rt.remote;
          const match = remotes.find(
            (r) => r.name === remoteName || r.aliases?.includes(remoteName),
          );
          if (match) {
            addUrlOrigins(match.url, match.port, sources);
          }
        }
      }
    }
  }

  return [...sources];
}

export function createNonce(): string {
  return randomBytes(16).toString("base64url");
}

export function buildWebviewCsp(options: {
  cspSource: string;
  nonce: string;
  board?: unknown;
  remotes?: readonly Remote[];
}): string {
  const connectSources = [
    options.cspSource,
    "data:",
    "blob:",
    ...extractRuntimeConnectSources(options.board, options.remotes ?? []),
  ];

  const directives = [
    "default-src 'none'",
    `script-src ${options.cspSource} 'nonce-${options.nonce}' 'wasm-unsafe-eval'`,
    `style-src ${options.cspSource} 'unsafe-inline'`,
    `font-src ${options.cspSource} data:`,
    `img-src ${options.cspSource} data: blob: https: http:`,
    `media-src ${options.cspSource} data: blob: https: http:`,
    `worker-src ${options.cspSource} blob:`,
    `connect-src ${connectSources.join(" ")}`,
  ];

  return directives.join("; ");
}

function isLocalAssetPath(url: string): boolean {
  if (!url) return false;
  if (/^(?:https?:|data:|blob:|vscode-webview-resource:|vscode-resource:|#)/i.test(url)) {
    return false;
  }
  return true;
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function buildWebviewHtml(options: {
  templateHtml: string;
  cspSource: string;
  nonce?: string;
  boardName: string;
  board?: unknown;
  remotes?: readonly Remote[];
  asWebviewUri: (relativePath: string) => string;
}): string {
  const nonce = options.nonce ?? createNonce();
  const csp = buildWebviewCsp({
    cspSource: options.cspSource,
    nonce,
    board: options.board,
    remotes: options.remotes,
  });

  // Rewrite local asset references (`src="/assets/..."`, `href="./assets/..."`)
  // through `asWebviewUri`.
  let html = options.templateHtml.replace(
    /\b(src|href)=["']([^"']+)["']/gi,
    (full, attr: string, rawPath: string) => {
      if (!isLocalAssetPath(rawPath)) {
        return full;
      }
      const cleanPath = rawPath.replace(/^(?:\.\/|\/)+/, "");
      if (!cleanPath) {
        return full;
      }
      return `${attr}="${options.asWebviewUri(cleanPath)}"`;
    },
  );

  // Attach the CSP nonce to existing `<script>` tags.
  html = html.replace(/<script\b(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"`);

  const shimScript = buildHkpShimScript({ boardName: options.boardName });
  const headInjection = [
    `<meta http-equiv="Content-Security-Policy" content="${escapeHtmlAttribute(csp)}" />`,
    `<script nonce="${nonce}">${shimScript}</script>`,
  ].join("\n    ");

  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, (match) => `${match}\n    ${headInjection}`);
  } else {
    html = `${headInjection}\n${html}`;
  }

  return html;
}
