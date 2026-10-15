# Readymade MCP knowledge server

A read-only MCP server over the documentation, example boards, and runtime
source code in a pinned Readymade checkout. It complements Board Assist's
bundled offline knowledge provider; it does not replace it.

The server uses the official TypeScript SDK v2 and supports its current MCP
HTTP protocol as well as the SDK's stateless compatibility path for 2025-era
clients.

## Run locally

Requires Node.js 22 or newer.

```sh
cd readymade-mcp
npm install
npm run build
npm run dev -- --root ..
```

The HTTP endpoint is `http://127.0.0.1:8787/mcp` and health information is at
`http://127.0.0.1:8787/health`. For clients that launch MCP processes, use:

```sh
npm run dev -- --stdio --root ..
```

The server exposes:

- `search_knowledge`
- `get_service_contract`
- `find_compatible_services`
- `find_board_examples`
- `read_document`
- `inspect_service_source`
- `validate_board`

Board Assist always uses `search_knowledge` and `read_document` when this MCP
endpoint is configured. Its Anthropic provider also advertises the other five
allowlisted operations directly to the model. OpenAI-compatible providers use
bounded search/read pre-retrieval for now.

All file access is restricted to the index built at startup. Source inspection
can only return bounded excerpts from the Browser, Node, Python, and C++ runtime
source roots. Each result identifies its repository commit and build version.
It also carries a SHA-256 hash of the exact indexed bytes, so provenance stays
verifiable when the server is intentionally run from a dirty development tree.

The HTTP server binds to loopback and validates Host and Origin by default.
It answers CORS preflight requests for loopback browser origins, allowing a
local playground to connect without weakening the origin guard.
To connect from a named browser host while keeping the server on loopback, add
that hostname explicitly:

```sh
npm run dev -- --root .. --allowed-origin readymadeit.com
```

`--allowed-origin` and `--allowed-host` are repeatable and accept hostnames,
not complete URLs. Non-loopback binding requires at least one of each.
Treat non-loopback deployment as a separate production task: configure strict
allowlists and add authentication before exposing the endpoint.
