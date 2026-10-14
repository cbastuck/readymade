# Board assistant

Build and change a board through a conversation beside the runtime canvas.
Open it with the sparkle button beside zoom in the playground toolbar. Close it with the same button or the panel's close button. The conversation
stays available while the panel is hidden; it is not saved in the board file.

## Setup

Open **Settings → AI assistant**, in either the website or the native Readymade
app. Choose **Anthropic** or **OpenAI compatible**, enter the provider's settings,
and save. The assistant panel also has a **Provider** selector. Switching providers
or API servers clears the conversation so a previous provider's history is not
sent to a different server. The board and revert checkpoint are kept.

For Anthropic, enter an API token. For OpenAI-compatible servers, enter an **API
base URL** including `/v1`, and an optional API token. An unauthenticated local
llama.cpp server does not need a token. For example:

- Provider: **OpenAI compatible**
- API base URL: `http://127.0.0.1:8081/v1`
- API token: empty unless the server was launched with authentication
- Server context size: **8192** when using `llama-server -c 8192`

Save, then select **OpenAI compatible** in the panel. It queries `/v1/models`
and lists the returned model IDs, such as `Bonsai-27B-Q1_0.gguf`. **Refresh models**
repeats that query. Requests use `/v1/chat/completions` with JSON output mode;
the model and its chat template must support following instructions and producing
JSON. Responses are streamed so slow generation can show progress without
waiting for the entire response. A server that ignores streaming is accepted
with a normal JSON response. Hosted endpoints work with the same fields. Browser clients need the server
to allow their origin through CORS.

For llama.cpp, **Thinking mode** can be **Server default**, **Off**, or **On**.
The assistant panel's **Effort** selector offers **Server default**, **Thinking off**,
and **Thinking on** for OpenAI-compatible servers. It shares the saved thinking
setting with Settings, so it can be changed directly before the next request.
Off sends `chat_template_kwargs: { enable_thinking: false }`; On sends true.
Leave Server default for endpoints without llama.cpp's template options. This
controls thinking in the template and is separate from the context-size setting.
Thinking can use the output budget before the final board appears.

A connection failure during generation can mean a timeout or disconnect, even
when the server is still working. It does not establish a CORS problem. The
panel distinguishes initial connection errors from interrupted response streams;
**Stop** cancels the request and an incomplete stream is never offered as a board.

The compatible provider retrieves relevant repository pages before generating,
using a conservative budget for the configured context size. It preserves the
full current board and rejects a request that cannot fit rather than truncating
its configuration. Older conversation may be omitted to fit the latest board.
Larger boards may require increasing both the server's context size and this
setting. This does not change the server's context limit itself.

Anthropic uses its official browser-capable TypeScript SDK and Models API,
following all model-list pages. Effort offers the levels the selected Anthropic
model reports it supports; **Model default** omits effort. Compatible servers use
their model default, since the standard model-list API does not report supported
effort levels. The provider, model, effort and server settings are saved on this
device. **API settings** replaces **Send** if the active provider lacks its required
settings; local servers can send with no API token.

Tokens are stored in the browser or app webview's local storage, outside board
files and share links. This is not the native operating system's encrypted
credential store. Requests go directly to the selected provider or API server;
hosted API usage is billed to that account.

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
retrieved by the assistant are sent to the selected provider or API server. Board configuration can include
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
