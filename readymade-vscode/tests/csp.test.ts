import { describe, expect, it } from "vitest";
import {
  buildWebviewCsp,
  buildWebviewHtml,
  extractRuntimeConnectSources,
} from "../src/csp.js";

describe("CSP and webview HTML generation", () => {
  it("extracts HTTP and WebSocket connect-src origins for direct and named remote runtimes", () => {
    const board = {
      boardName: "Hybrid Board",
      runtimes: [
        { id: "ui", name: "Browser", type: "browser" },
        {
          id: "direct",
          name: "Direct Node",
          type: "rest",
          url: "https://node.example.com:8443/api",
        },
        {
          id: "named",
          name: "Named Python",
          type: "rest",
          remote: "python",
        },
        {
          id: "legacy",
          name: "Legacy Remote",
          type: "rest",
          url: "hkp://remotes/studio",
        },
      ],
      services: {},
    };

    const remotes = [
      { name: "node", url: "http://127.0.0.1:8080", port: 8080 },
      { name: "python", url: "http://192.168.1.40:8081", port: 8081 },
      {
        name: "studio-box",
        url: "https://studio.example.org",
        port: 9443,
        aliases: ["studio"],
      },
    ];

    const sources = extractRuntimeConnectSources(board, remotes);

    // Loopback wildcards are always included for local runtimes
    expect(sources).toContain("http://127.0.0.1:*");
    expect(sources).toContain("ws://127.0.0.1:*");
    expect(sources).toContain("http://localhost:*");
    expect(sources).toContain("ws://localhost:*");

    // Direct URL runtime (both https and wss)
    expect(sources).toContain("https://node.example.com:8443");
    expect(sources).toContain("wss://node.example.com:8443");

    // Named remote runtime resolved against saved remotes
    expect(sources).toContain("http://192.168.1.40:8081");
    expect(sources).toContain("ws://192.168.1.40:8081");

    // Legacy hkp://remotes/<alias> resolved via remote alias + port
    expect(sources).toContain("https://studio.example.org:9443");
    expect(sources).toContain("wss://studio.example.org:9443");
  });

  it("rewrites local assets via asWebviewUri and injects CSP and the hkp:// fetch shim", () => {
    const templateHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <script type="module" crossorigin src="/assets/index-abc.js"></script>
    <link rel="stylesheet" crossorigin href="./assets/index-def.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

    const html = buildWebviewHtml({
      templateHtml,
      cspSource: "https://file+.vscode-resource.vscode-cdn.net",
      nonce: "test-nonce-123",
      boardName: "Timer Demo",
      board: {
        boardName: "Timer Demo",
        runtimes: [
          {
            id: "node",
            name: "Node",
            type: "rest",
            url: "http://127.0.0.1:8080",
          },
        ],
        services: { node: [] },
      },
      remotes: [],
      asWebviewUri: (rel) =>
        `https://file+.vscode-resource.vscode-cdn.net/webapp/${rel}`,
    });

    expect(html).toContain(
      'src="https://file+.vscode-resource.vscode-cdn.net/webapp/assets/index-abc.js"',
    );
    expect(html).toContain(
      'href="https://file+.vscode-resource.vscode-cdn.net/webapp/assets/index-def.css"',
    );
    expect(html).toContain(
      'href="https://file+.vscode-resource.vscode-cdn.net/webapp/vite.svg"',
    );
    expect(html).toContain('nonce="test-nonce-123"');
    expect(html).toContain("http://127.0.0.1:8080");
    expect(html).toContain("ws://127.0.0.1:8080");
    expect(html).toContain("window.__MEANDER_VSCODE__ = true;");
    expect(html).toContain('window.__MEANDER_INITIAL_BOARD_NAME__ = "Timer Demo";');
  });

  it("includes cspSource and nonce in buildWebviewCsp", () => {
    const csp = buildWebviewCsp({
      cspSource: "vscode-webview-resource:",
      nonce: "nonce-xyz",
    });
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain(
      "script-src vscode-webview-resource: 'nonce-nonce-xyz' 'wasm-unsafe-eval'",
    );
    expect(csp).toContain("connect-src vscode-webview-resource:");
  });
});
