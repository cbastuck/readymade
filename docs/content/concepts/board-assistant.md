# Board assistant

Build and change a board through a conversation beside the runtime canvas.
Open it with the sparkle button beside zoom in the playground toolbar. Close it with the same button or the panel's close button. The conversation
stays available while the panel is hidden; it is not saved in the board file.

## Setup

Open **Settings → Board Assist**, in either the website or the native Readymade
app. Choose **Anthropic** or **OpenAI compatible**; only the chosen provider's
settings are shown. As in Appearance, changes take effect as you make them — a
choice at once, a text field when you leave it — and an invalid value is
explained under its field instead of being saved. Each saved token can be
removed with the × beside its section. The assistant panel also has a **Provider** selector. Switching providers
or API servers clears the conversation so a previous provider's history is not
sent to a different server. The board is kept; the conversation's revert
checkpoint goes with it.

For Anthropic, enter an API token. For OpenAI-compatible servers, enter an **API
base URL** including `/v1`, and an optional API token. An unauthenticated local
llama.cpp server does not need a token. For example:

- Provider: **OpenAI compatible**
- API base URL: `http://127.0.0.1:8081/v1`
- API token: empty unless the server was launched with authentication
- Server context size: **8192** when using `llama-server -c 8192`

Then select **OpenAI compatible** in the panel. It queries `/v1/models`
and lists the returned model IDs, such as `Bonsai-27B-Q1_0.gguf`. **Refresh models**
repeats that query. Requests use `/v1/chat/completions` with JSON output mode;
the model and its chat template must support following instructions and producing
JSON. Responses are streamed so slow generation can show progress without
waiting for the entire response. A server that ignores streaming is accepted
with a normal JSON response. Hosted endpoints work with the same fields. Browser clients need the server
to allow their origin through CORS. An address using plain `http://` to anything
but this machine is accepted with a warning, in Settings and in the panel: the
token, prompts and board cross the network unencrypted. The MCP server URL is
warned about the same way.

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

The repository also contains an optional read-only MCP knowledge server in
`readymade-mcp/`. It indexes the same documentation plus example boards and
allowlisted runtime source from a pinned checkout. Its tools can search, read
contracts, find compatible services and examples, inspect bounded source
excerpts, and statically validate a board. Each result carries build and commit
provenance.

To use it with Board Assist, run the server and set **Settings → Board Assist →
Knowledge server → MCP server URL**, for example
`http://127.0.0.1:8787/mcp`. The URL is device-local configuration and is not
written into boards. Both providers can consume the server's search and
document-reading tools. Anthropic also receives the allowlisted contract,
compatibility, example, source-inspection and board-validation operations as
model-controlled tools. OpenAI-compatible providers retain bounded
pre-retrieval until their tool-calling support can be detected reliably.

The MCP connection has bounded connect and tool-call timeouts. What happens when
a call fails depends on what the failure says about the server:

- **The server refused this call** — a tool result marked as an error, or a
  JSON-RPC error: invalid arguments, an unknown path or service. The server is
  reachable, so only that call is answered from the bundled documentation (or
  its error goes back to the model), and the rest of the turn keeps using MCP.
- **The server cannot serve the turn** — a network or CORS failure, an HTTP
  error, a timeout, a closed connection, missing required tools, or replies in
  a shape Board Assist does not understand. The rest of the turn uses the
  bundled documentation and the panel shows a fallback notice. It is not retried
  within the turn: seconds later it is unlikely to have recovered.

The next turn tries the server again, which costs nothing when it refuses
connections. A server that failed **slowly** — a timeout, or any failure that
took two seconds or more — is skipped by later turns for a minute instead, so a
hanging server does not delay every request before the offline path is used.
Cancellation still stops the request. Leaving the MCP URL empty keeps the fully
offline path and does not load the MCP client.

The MCP server receives knowledge search terms, requested document paths and
arguments to richer operations. Those arguments can include the current or
proposed board when the model calls `validate_board`. Provider API tokens are
not sent to MCP. Treat a configured MCP endpoint as a trusted recipient of this
context even though retrieved content is still treated as untrusted model data.

The local server accepts browser origins on loopback by default. When Board
Assist is served from a named host, explicitly allow that hostname when starting
the server, for example `--allowed-origin readymadeit.com`. A non-loopback MCP
deployment additionally needs strict Host and Origin allowlists and
authentication before it should be exposed publicly.

Every request is built from the board as it is at that moment, with the
available runtime engines and service catalog, the selected services and the
open nested pipeline. **Context** decides how much of the board goes with it and
what the assistant may change:

- **Only runtime …** — when a runtime is selected. The assistant receives that
  runtime and its services in full, and the rest of the board only as an
  outline: runtimes in order with their services' ids and names, no state, and
  which services the facade uses. It proposes that runtime alone, which is
  merged into the current board; nothing outside it can change, whatever the
  model writes. A request that needs other runtimes, the facade, assets or
  blocks is answered by asking to switch to the whole board. Blocks, assets and
  imported units the runtime refers to are included as context. A runtime
  contributed by an imported unit cannot be edited through the board, so
  selecting one uses the whole board.
- **Whole board** — the complete board and imported unit documents; the
  proposal is a complete board.

Select a service before asking to change "this service". Ambiguous requests can
receive a clarification instead of a change. Imported unit documents cannot be
edited through their containing board here.

**Include asset contents** is off by default: assets are sent as their id and
media type only, and a proposal that keeps an asset gets its contents back from
the current board. Turn it on to let the assistant read or rewrite an asset's
text — a page, a script. The choice is saved on this device.

Your prompts, the board context above, conversation history and the
documentation retrieved by the assistant are sent to the selected provider or
API server; the line under the prompt says what the next request carries and
where it goes. Service state can include credentials entered directly; use
secret references where possible — a `{{secret.…}}` reference is sent, never
its value. Credentials from **Board Assist** settings are used for
authentication and are not added to the model's conversation.

## Review, apply and revert

The assistant explains its proposal and offers **Show changes** beside
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
structural validation and the normal board linker checks its blocks and
references without loading runtimes. A failed preflight leaves the proposal and
diff available, but disables direct application; edit it in the diff to repair
and revalidate it. Service-specific behavior still needs testing with the actual
devices and runtime servers.

**Apply board** loads the proposed configuration through BoardContext. This
rebuilds the runtimes and can start services, connect to remote servers, or request
camera and microphone permissions. Timer ticks and JSON object key ordering do not count as edits for this check.
If the board configuration changed after the request,
applying is refused: ask for a new proposal using the current board.

A proposal that would make the board contact an address it does not use yet is
not applied until you say so — from the message or from the diff. The
assistant read board content, documentation and knowledge-server results
nobody on your side wrote, so an address in its output is not trusted just
because you asked for a change. Board Assist lists the new origins: runtime
servers, which run part of the board and receive your Readymade sign-in, and
any other address in service state, assets or the facade, which services may
connect and send board data to. An origin counts as known when it appears
anywhere in the current board or its imported units. Vault secrets are asked
about separately, per server, when a runtime first needs them.

Runtimes that **name** their server never need this confirmation, because a
name resolves only to a server you keep (`"remote": "node"`, `"remote":
"embedded"`; see [Remotes](./remotes.md)). Board Assist leans on that:

- The assistant is shown your runtime servers by name only — their addresses
  are not sent to the provider — and is told to use `remote`, never `url`.
- When a proposal still gives a runtime the address of a server you keep, that
  address is replaced by the server's name, the same name the runtime picker
  would write, and the message says so. A runtime keeping the `url` it already
  has is left alone; ask for the change if you want it named.
- A name you keep nothing under is asked about when the board loads: you say
  which server it means. The address comes from you, not from the model.

Addresses in service state are not covered by names and are still confirmed.

Service panels and facade panels have independent render boundaries, so one
broken panel reports its error in place instead of taking down the playground.
Board Assist watches those boundaries while applying. A load or render failure
automatically reloads the checkpoint from before the attempt and keeps the
proposal available for inspection or editing. This is transactional failure
containment, not a security sandbox: services may begin initialization during
the attempted load, so external effects that already occurred cannot be undone.

**Revert** replaces **Apply board** in the proposal after a successful
application. It restores the complete configuration from immediately
before the last assistant application, including its assets, blocks and facade.
If automatic restoration itself fails, the manual revert remains available.
Revert replaces the current configuration. When the board has changed since the
proposal was applied, it asks first, because those later edits would be
discarded. It does not undo notifications, HTTP requests or other effects
services have already produced. There is one previous configuration, kept for
the conversation.

**Stop** cancels the current API request. **New conversation** clears the chat
and its revert checkpoint without changing the board. Conversation and revert history are not persisted
across leaving the playground or reloading the app.
