# Readymade MCP knowledge server

Board Assist already gives an agent bounded tools for searching and reading the
documentation and example boards bundled into each Readymade host. Keep that
offline path. Add a version-aware knowledge layer whose richer implementation
can also be exposed as an MCP server and reused by Board Assist, coding agents,
IDEs and documentation tooling.

## Decisions

- The bundled provider remains the default and must continue to work offline in
  browsers and native apps.
- MCP is an optional richer provider, not a runtime requirement and not a
  replacement for bundled documentation.
- Board Assist depends on a knowledge-provider interface, not on MCP transport
  details.
- The live runtime registry is authoritative for what can be added to the
  current board.
- Contracts and source must be resolved against the running Readymade build or
  an explicitly selected version. Latest `main` must never silently describe an
  older installed build.
- Source retrieval is bounded to allowlisted repositories and paths. GitHub
  credentials stay on the server, never in a board or browser client.
- Applying a proposed board remains a separate, reviewed operation.

## Source-of-truth order

1. The connected runtime registry: whether a service is available here.
2. A structured service contract matching the running build.
3. Documentation matching that build.
4. Implementation source pinned to the same immutable commit.
5. Examples matching that version.
6. Newer branch content only when explicitly requested and labelled as newer.

## Intended operations

- `search_knowledge(query, runtime?, kind?)`
- `get_service_contract(serviceId, runtime, version?)`
- `find_compatible_services(inputType, outputType, runtime?)`
- `find_board_examples(serviceIds, runtime?)`
- `read_document(paths)`
- `inspect_service_source(serviceId, runtime, version?)`
- `validate_board(board)`

The first provider boundary implements only search and read because those are
the operations Board Assist has today. Add each richer operation when its
result contract and source of truth are defined; do not make optional methods
that silently return incomplete data.

## Result provenance

Every remote contract, document, example and source result should identify:

- repository and immutable commit SHA;
- path, and line/symbol range where applicable;
- Readymade release/build version;
- runtime and canonical service ID where applicable;
- whether it exactly matches the requesting host's build;
- content kind and last indexed time.

## Milestones

### 1. Provider seam — in progress

- [x] Define the minimal `ReadymadeKnowledgeProvider` boundary.
- [x] Wrap the existing bundled documentation as the offline provider.
- [x] Route Anthropic and OpenAI-compatible Board Assist retrieval through it.
- [x] Add provider-level tests proving an injected implementation is used.
- [ ] Keep foundation documents and the documentation index stable while the
  richer discovery contract is designed.

### 2. Structured local knowledge

- [ ] Define versioned result/reference and provenance schemas.
- [ ] Build a generated index instead of loading every document for each
  substring search.
- [ ] Index headings, service IDs and aliases, runtime, input/output types,
  configuration, permissions, examples and implementation references.
- [ ] Generate or validate structured service contracts from service metadata,
  documentation, registries and tests.
- [ ] Add deterministic compatibility lookup before considering semantic
  retrieval.
- [ ] Make validation return actionable, service-specific diagnostics rather
  than only structural board errors.

### 3. MCP server

- [ ] Choose the server package/runtime and supported MCP specification version.
- [ ] Expose the knowledge operations as model-controlled MCP tools; optionally
  expose individual immutable documents as URI-addressed MCP resources.
- [ ] Implement Streamable HTTP transport, authentication where needed,
  capability discovery, caching hints, request limits and tracing.
- [ ] Publish the same operation schemas for direct in-process use and MCP use.
- [ ] Add contract tests that run identical queries against bundled and MCP
  providers where their capabilities overlap.

### 4. Board Assist MCP adapter

- [ ] Add an MCP-backed `ReadymadeKnowledgeProvider` with bounded timeouts and
  cancellation.
- [ ] Configure optional server connection and trust information outside board
  files.
- [ ] Fall back to bundled retrieval when MCP is absent or unavailable; surface
  clearly when a requested richer operation needs the server.
- [ ] Generalize the Anthropic tool loop so operations are registered rather
  than hardcoded.
- [ ] Feature-detect tool calling for OpenAI-compatible servers; retain bounded
  pre-retrieval for servers without it.
- [ ] Show provenance/version mismatch information in Board Assist responses.

### 5. Pinned source inspection

- [ ] Map each service/runtime/version to its implementation paths and symbols.
- [ ] Fetch only from an allowlist at an immutable commit and cache excerpts.
- [ ] Bound file size, excerpt size, line ranges, redirects and call count.
- [ ] Treat retrieved source as untrusted data and preserve the assistant's
  prompt-injection boundary.
- [ ] Support private repositories without exposing provider tokens to clients.

### 6. Evaluation and rollout

- [ ] Build representative board-authoring and debugging evaluations: service
  selection, cross-runtime differences, adjacent I/O compatibility, obsolete
  docs, missing configuration and source escalation.
- [ ] Compare bundled-only, structured-local and MCP-assisted accuracy, latency
  and token use.
- [ ] Log operation name, duration, result count, provider/version and failure
  category without logging secrets or complete board state.
- [ ] Keep MCP opt-in until fallback, version pinning and failure behavior pass
  browser, desktop and mobile tests.

## Open questions

- Which component publishes the build-to-commit manifest for browser, native
  and remote runtimes?
- Should one MCP deployment index every released version, or should each
  release publish an immutable knowledge artifact consumed by the server?
- Where should generated service contracts live so all runtimes can validate
  them without making the frontend the owner?
- Which type vocabulary is canonical enough for compatibility queries across
  runtimes (`JSON`, `MixedData`, `FloatRingBuffer`, and service-specific shapes)?
- Is the first MCP server public read-only, authenticated per installation, or
  both with source inspection protected separately?
