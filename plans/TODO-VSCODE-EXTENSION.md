# Readymade in VS Code

A VS Code extension that makes the editor a host for the playground: boards
opened from the workspace as files, the playground's lists — remotes and their
runtimes, cloud boards, demos, a board's runtimes and services, its assets and
blocks — as native sidebar views, and a service's configuration editable as a
document with completion drawn from the service's documentation.

It is for the people who build boards and services, and who already live in an
editor: a board kept in git beside the code it uses, a service edited in its
runtime's source while the board using it runs next to it.

## Decisions

- **The extension is another host, not another engine.** Browser services are
  React components using browser APIs (audio, canvas, the service UIs); the
  extension host is plain Node and runs none of them. The board engine runs in a
  webview, exactly as it runs in a browser tab or a meander shell, and plays the
  browser's role in the coordinator table (`docs/content/concepts/coordinator.md`).
  Everything native — tree views, documents, diagnostics — is a view over the
  state that webview holds.
- **The host is reached through the seam that already exists.** A VS Code
  webview cannot register a custom scheme, so the extension installs a `fetch`
  shim that forwards `hkp://…` to the extension host over `postMessage` — the
  approach Android already takes, for the same reason
  (`docs/content/targets.md`, "How the app reaches its host"). Capabilities reach
  the app through `PlatformCapabilities`; one the extension does not provide is
  a feature that does not appear, as on the web.
- **Native views stay thin.** A tree view lists, selects and opens; what happens
  after that is a playground component in a webview. Each native view that
  re-implements playground behaviour is a second UI to keep in step, and the two
  drift.
- **A board is a workspace file.** `*.board.json` opens in a custom editor;
  saving writes the file, so history, diffs and branches come from git. The
  board document is the one in `docs/content/board-json.md` — nothing
  extension-specific is written into it.
- **Completion comes from the contracts `readymade-mcp` already builds.**
  `ServiceContract.configuration` (`readymade-mcp/src/types.ts`) is turned into
  JSON Schema and contributed through `jsonValidation`; VS Code's JSON language
  service then supplies completion, hover and validation. `validate_board`
  results become diagnostics. The live runtime registry stays authoritative for
  what can be added (`TODO-MCP-KNOWLEDGE.md`, "Source-of-truth order").

## The mapping

| Playground                         | VS Code                                                         |
| ---------------------------------- | --------------------------------------------------------------- |
| Remotes and the runtimes they host | Tree view in a Readymade activity-bar container                  |
| Cloud boards                       | Tree view; attach opens the board's facade or its playground    |
| Demos                              | Tree view over the demo catalogue; open copies into the workspace |
| A board's runtimes and services    | Outline tree for the active board, in chain order               |
| A service's ServiceUI              | Webview editor tab bound to the live service                    |
| A service's state                  | Text document `readymade://<board>/<runtime>/<uuid>.json`; save is `configure` |
| Assets                             | Tree view; dropping a file from the Explorer creates a descriptor |
| Blocks                             | Tree view; open edits the block's definition                    |
| Facade                             | Webview panel beside the code: the app as its users see it      |
| Board Assist                       | `readymade-mcp` registered as an MCP server, plus the running board exposed to the editor's agent |
| Secrets                            | `hkp://secrets` answered from VS Code `SecretStorage`           |
| Sign-in                            | A VS Code `AuthenticationProvider`; the session handed to the app |

The ordered tree is a faithful view of a board, not an approximation: the
order of runtimes and services *is* the wiring, so there are no wires a tree
would lose.

## Milestones

### V1 — the playground as a custom editor (built)

- [x] `readymade-vscode/` at the repository root, beside `readymade-mcp/`.
- [x] A custom editor for `*.board.json` loading the built frontend into a webview
  via `asWebviewUri`, with a CSP that allows the remote runtimes the board names.
- [x] The `hkp://` shim and the first route families: `boards` (the open document),
  `remotes` (kept in the extension's global state), `settings`.
- [x] The extension's routes tested against the same contract as
  `e2e/support/fakeNativeHost.ts`, so this host is held to it from the start
  (see T1 in `architectural-tradeoffs.md`).
- [x] JSON Schema for board documents and per-service state, generated from the
  indexed contracts at build time.

Done when a demo board opens from the workspace, runs against a local hkp-node,
and an edit in the playground shows up as an unsaved change in the file.

### V2 — native views driving the webview

- Remotes view and the board outline; selecting a service in the outline
  selects it in the playground, and the reverse.
- Service state as a virtual document with completion; save calls `configure`,
  and a change the service reports updates the open document.
- `validate_board` diagnostics in the Problems panel.

### V3 — the rest of the lists

- Assets (with Explorer drag and drop), blocks, demos, cloud boards.
- Sign-in through an `AuthenticationProvider`; attaching to a deployed board.
- `secrets` from `SecretStorage`, with the consent the app already asks for.

### V4 — the loop for service authors

- Running the board against a runtime built from the workspace (hkp-node,
  hkp-python, hkp-rt), restarted when its source changes, with the board
  reattached rather than reloaded.
- The running board exposed to the editor's agent, for the debugging that
  Live Board Assist needs from external agents.

## Open questions

- **Camera and microphone.** VS Code webviews may not grant `getUserMedia`;
  to verify. If they do not, boards using `camera`, `detect` or microphone
  input need an "open in browser" or "open in Readymade" path rather than a
  silent failure.
- **`"remote": "embedded"`.** The extension embeds no hkp-rt. Either the name
  stays unresolved and the existing remote prompt asks (`core/remotePrompt.ts`),
  or the extension starts a standalone hkp-rt as a child process and answers to
  the name. The second is closer to the app; it also means shipping binaries per
  platform.
- **Which frontend.** `hkp-frontend` as the web target, or `meander/frontend`,
  which already decides its host at startup (`isMeanderApp()`). The latter
  brings the library, history and secrets UI, but also the phone and Home
  Screen paths this host has no use for.
- **Several boards open at once.** One webview per board is simplest; it also
  means one engine per board, and remotes shared between them by name.
- **Where demos land.** Opening a demo could copy it into the workspace or open
  it read-only until saved; the first matches "a board is a file", the second
  matches the playground.
- **Which route families.** Of the families in use today (`boards`, `remotes`,
  `presets`, `secrets`, `history`, `settings`, `startpage`, `shared-boards`,
  `share-files`, `share-inbox`, `home-screen`, `board-art`, `local-image`,
  `mint-token`, `app`), which ones this host needs, and which it can leave
  absent.
- **Distribution.** Marketplace, Open VSX, or both.
