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

## Deploy for a hosted playground

A page served over https cannot call a server's plain-http port, so a hosted
playground reaches the server through a TLS reverse proxy. The server stays on
loopback behind it, and is told which public names to answer to:

The server needs no git. Bundle what it serves where git is — a development
machine or CI — and copy the bundle over:

```sh
cd readymade-mcp
npm run bundle
```

It writes `readymade-mcp/bundle/`, replacing the previous one, and git ignores
it. `npm run bundle -- --out <dir>` writes elsewhere, into a directory that
must not exist yet.

The bundle is written with `git archive`, so it holds what is committed at
HEAD — never an untracked board, an ignored file or a local edit — with the
runtime sources of the submodules at the commits the superproject records.
The commits go into `readymade-mcp-commits.json`, which the server reports as
provenance in place of `.git`. On the server:

```sh
cd bundle/readymade-mcp
npm ci && npm run build
node dist/cli.js --root .. \
  --allowed-host mcp.example.com --allowed-origin readymadeit.com
```

The proxy terminates TLS and limits what one client can ask for; the server
itself has no rate limit. An nginx example:

```nginx
limit_req_zone $binary_remote_addr zone=mcp:10m rate=5r/s;

server {
  listen 443 ssl;
  server_name mcp.example.com;
  # ssl_certificate / ssl_certificate_key …

  client_max_body_size 1m;

  location / {
    limit_req zone=mcp burst=20 nodelay;
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_read_timeout 30s;
  }
}
```

`proxy_set_header Host` matters: the server checks the Host header against
`--allowed-host`. Responses may stream as server-sent events, hence
`proxy_buffering off`.

Everything the server returns is already public in this repository, so the
hosted endpoint is public by design: the proxy's limits are what protect it. A private deployment can require a bearer token
on `/mcp` by setting `READYMADE_MCP_TOKEN`; preflight and `/health` stay open.
Board Assist does not send one yet, so a token suits clients that set their
own headers, such as Claude Code or the MCP inspector.

Tool calls are capped at 20,000 array elements and object members in their
arguments, request bodies at 1 MiB, and a request must arrive within 30
seconds.
