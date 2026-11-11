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

## The package

The npm package carries the knowledge it serves: `npm pack` and
`npm publish` first run `npm run bundle`, which writes `bundle/` with
`git archive` — the docs, example boards and runtime sources as committed at
HEAD, the submodules' at the commits the superproject records, and those
commits in `readymade-mcp-commits.json`. An untracked board, an ignored file or
a local edit never reaches it, so commit before packing. The bundle needs git
where it is made, and nothing where it is served.

Without `--root`, the installed server serves that bundle and reports the
package version as the build version:

```sh
npm install readymade-mcp
npx readymade-mcp --allowed-host mcp.example.com --allowed-origin readymadeit.com
```

`npm run bundle` on its own writes the same `bundle/`, replacing the previous
one; git ignores it. `npm run bundle -- --out <dir>` writes elsewhere, into a
directory that must not exist yet. `npm pack --dry-run` lists what would be
published.

## Deploy for a hosted playground

A page served over https cannot call a server's plain-http port, so a hosted
playground reaches the server through a TLS reverse proxy. The server stays on
loopback behind it and is told which public names to answer to:
`--allowed-host` for the name the proxy forwards in the Host header,
`--allowed-origin` for each browser origin that may call it. Origins are
matched by hostname; a custom scheme, such as an app webview's `hkp://app`, is
allowed as a whole with `--allowed-origin 'hkp://*'`.

readymadeit.com runs it under systemd behind Caddy:
`hkp-website/server/etc/systemd/system/readymade-mcp.service`, with the
Caddy site and the setup steps in `hkp-website/server/README.md`.

Everything the server returns is already public in this repository, so the
hosted endpoint is public by design, and its limits are what protect it:

- **Rate:** each client may make 120 requests a minute (`--rate-limit`, 0 for
  none); past that it gets 429 with `Retry-After`. The client is the
  connecting address, or — when that is loopback, as behind a proxy on the
  same machine — the last address in `X-Forwarded-For`. Preflight is not
  counted; `/mcp`, `/health` and unknown paths are.
- **Size:** request bodies are capped at 1 MiB and tool-call arguments at
  20,000 array elements and object members.
- **Time:** a request must arrive within 30 seconds, its headers within 10.

A private deployment can require a bearer token on `/mcp` by setting
`READYMADE_MCP_TOKEN`; preflight and `/health` stay open. Board Assist does not
send one yet, so a token suits clients that set their own headers, such as
Claude Code or the MCP inspector.
