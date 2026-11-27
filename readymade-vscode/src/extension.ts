import path from "node:path";
import {
  createBoardEditorSession,
  GlobalStateStore,
  loadTemplateHtml,
  type MementoLike,
  resolveWebAppDir,
} from "./boardEditor.js";
import type { TextDocumentLike, Thenable, WebviewMessage } from "./types.js";

export const BOARD_EDITOR_VIEW_TYPE = "readymade.boardEditor";

interface VsCodeUri {
  readonly fsPath: string;
  toString(): string;
}

interface VsCodeTextDocument {
  readonly uri: VsCodeUri;
  readonly fileName: string;
  readonly lineCount: number;
  getText(): string;
  lineAt(line: number): { range: { end: unknown } };
}

interface VsCodeWebview {
  readonly cspSource: string;
  html: string;
  options: {
    enableScripts?: boolean;
    localResourceRoots?: VsCodeUri[];
  };
  asWebviewUri(localResource: VsCodeUri): VsCodeUri;
  postMessage(message: WebviewMessage): Thenable<boolean>;
  onDidReceiveMessage(
    listener: (e: unknown) => unknown,
  ): { dispose(): void };
}

interface VsCodeWebviewPanel {
  readonly webview: VsCodeWebview;
  onDidDispose(listener: () => void): { dispose(): void };
}

interface VsCodeExtensionContext {
  readonly extensionPath: string;
  readonly globalState: MementoLike;
  readonly subscriptions: Array<{ dispose(): void }>;
}

export async function activate(context: VsCodeExtensionContext): Promise<void> {
  // Loaded dynamically so the core modules can be imported in Node test suites
  // without the VS Code extension host runtime.
  const vscodeModuleName = "vscode";
  const vscode = await import(vscodeModuleName);

  const webAppDir = resolveWebAppDir(context.extensionPath);
  const stateStore = new GlobalStateStore(context.globalState);

  const provider = {
    async resolveCustomTextEditor(
      document: VsCodeTextDocument,
      webviewPanel: VsCodeWebviewPanel,
    ): Promise<void> {
      const webAppRootUri = vscode.Uri.file(webAppDir);
      webviewPanel.webview.options = {
        enableScripts: true,
        localResourceRoots: [
          webAppRootUri,
          vscode.Uri.file(context.extensionPath),
        ],
      };

      let lastAppliedText: string | null = null;

      const documentAdapter: TextDocumentLike = {
        fileName: document.fileName,
        getText: () => document.getText(),
        applyEdit: async (newText: string) => {
          lastAppliedText = newText;
          const edit = new vscode.WorkspaceEdit();
          const lastLine = Math.max(0, document.lineCount - 1);
          const endPos = document.lineAt(lastLine).range.end;
          const fullRange = new vscode.Range(
            new vscode.Position(0, 0),
            endPos,
          );
          edit.replace(document.uri, fullRange, newText);
          return Boolean(await vscode.workspace.applyEdit(edit));
        },
      };

      const session = createBoardEditorSession({
        document: documentAdapter,
        stateStore,
        templateHtml: loadTemplateHtml(webAppDir),
        webview: {
          get cspSource() {
            return webviewPanel.webview.cspSource;
          },
          get html() {
            return webviewPanel.webview.html;
          },
          set html(value: string) {
            webviewPanel.webview.html = value;
          },
          get options() {
            return webviewPanel.webview.options;
          },
          set options(value) {
            webviewPanel.webview.options = value as {
              enableScripts?: boolean;
              localResourceRoots?: VsCodeUri[];
            };
          },
          asWebviewUri: (relativePath: string) =>
            webviewPanel.webview
              .asWebviewUri(vscode.Uri.file(path.join(webAppDir, relativePath)))
              .toString(),
          postMessage: (message: WebviewMessage) =>
            webviewPanel.webview.postMessage(message),
          onDidReceiveMessage: (listener: (message: unknown) => unknown) =>
            webviewPanel.webview.onDidReceiveMessage(listener),
        },
      });

      const changeDocSubscription = vscode.workspace.onDidChangeTextDocument(
        (event: { document: VsCodeTextDocument; contentChanges: readonly unknown[] }) => {
          if (
            event.document.uri.toString() !== document.uri.toString() ||
            event.contentChanges.length === 0
          ) {
            return;
          }
          if (lastAppliedText !== null && event.document.getText() === lastAppliedText) {
            lastAppliedText = null;
            return;
          }
          session.notifyExternalDocumentChange();
        },
      );

      webviewPanel.onDidDispose(() => {
        changeDocSubscription.dispose();
        session.dispose();
      });
    },
  };

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      BOARD_EDITOR_VIEW_TYPE,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      },
    ),
  );
}

export function deactivate(): void {}
