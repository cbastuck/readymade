# Board assistant

Build and change a board through a conversation beside the runtime canvas.
Open it with the sparkle button beside zoom in the playground toolbar. Close it with the same button or the panel's close button. The conversation
stays available while the panel is hidden; it is not saved in the board file.

## Setup

Open **Settings → AI assistant**, in either the website or the native Readymade
app. Enter an Anthropic API token and save it. When no Anthropic token is configured, **API settings** replaces **Send**
at the bottom of the panel and opens this settings tab. Tokens are kept in the browser or app webview's local storage
on this device. They are not included in board files, exports, or share links.
This storage is not the native operating system's encrypted credential store.

The assistant currently uses Anthropic. The settings can also keep an OpenAI
compatible token and API base URL for a future provider integration; those
credentials are not used for generation yet.

The panel queries Anthropic's Models API with the saved token, following all
pages, and lists the returned models. **Refresh models** repeats that query.
Effort offers the levels the selected model reports it supports; **Model default**
omits the effort parameter. Models without effort support use their default.
The selected model and effort are saved on this device.

Requests use the official Anthropic TypeScript SDK with browser access enabled,
including its browser CORS headers. They go directly from the browser or native
webview to Anthropic. API usage is billed to the token's account.

## Building and editing

Describe what the board should do. For example:

> Create a board that runs every minute, captures an image using the browser
> Camera service, detects faces, and sends a notification to ntfy topic xxx
> when there are faces.

The assistant can search and read the documentation in `docs/content/` and the
JSON examples in `boards/`. Both are packaged into builds, so the documentation
matches that build and requires no documentation server. It reads the relevant
service contracts, configuration and data shapes before proposing a board.

Every request includes a fresh serialized board configuration, the available
runtime engines and service catalog, the selected runtime and services, and
the open nested pipeline. **Context** can use the current selection or the whole
board. Select a service before asking to change "this service". The complete
board still accompanies a scoped request so the assistant can preserve its
surroundings. Ambiguous requests can receive a clarification instead of a change.
Imported unit documents cannot be edited through their containing board here.

Your prompts, board configuration, conversation history and the documentation
retrieved by the assistant are sent to Anthropic. Board configuration can include
credentials entered directly into service state; use secret references where
possible. Credentials from **AI assistant** settings are used for authentication
and are not added to the model's conversation.

## Review, apply and revert

The assistant explains its proposal and offers **Preview changes** beside
**Apply board**. Preview opens a Monaco JSON diff: the current board
on the left and the proposal on the right, with removed lines in red and added
lines in green. Narrow windows use an inline diff. The current board is read
afresh when opening the preview; viewing it does not apply the proposal. The current side is read-only; the
proposed side can be edited. **Apply edited board** validates and applies your
JSON, including manual changes, and supports the same revert action. Invalid
JSON or a board-load error keeps the editor open with your draft intact.
**Cancel** discards the draft. Applying from the diff checks for configuration
changes since the diff was opened, so the current side you reviewed is the
configuration being replaced. A proposal does not change the running board. It first passes
structural validation; applying it also uses the normal board linker to check
blocks and references. Service-specific behavior still needs testing with the
actual devices and runtime servers.

**Apply board** loads the proposed configuration through BoardContext. This
rebuilds the runtimes and can start services, connect to remote servers, or request
camera and microphone permissions. Timer ticks and JSON object key ordering do not count as edits for this check.
If the board configuration changed after the request,
applying is refused: ask for a new proposal using the current board.

**Revert last change** appears below the conversation when a board proposal
arrives, and becomes enabled after applying a change. It restores the complete configuration from immediately
before the last assistant application, including its assets, blocks and facade.
It remains available if loading a proposed board fails. Revert replaces the
current configuration, including edits made after applying; it does not undo
notifications, HTTP requests or other effects services have already produced.
There is one previous configuration, kept for this panel's lifetime.

**Stop** cancels the current API request. **New conversation** clears the chat
without changing the board. Conversation and revert history are not persisted
across leaving the playground or reloading the app.
