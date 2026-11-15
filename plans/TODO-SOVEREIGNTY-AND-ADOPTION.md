# Sovereignty, resilience and community adoption

Working document for removing the remaining external service dependencies,
closing operational self-hosting gaps, and making authored board logic
verifiable by non-coders in families, clubs, flatshares and small
organisations.

**Status legend:** ☐ not started · ◐ in progress · ☑ done · ✎ needs design before build
**Effort legend:** S = under a day · M = 2–4 days · L = 1–2 weeks

---

## Where we stand

| ID | Gap | Target | Effort | Status |
| --- | --- | --- | --- | --- |
| **R1a** | Standard OIDC discovery (`ISSUER_URL`) alongside `AUTH0_DOMAIN` | `hkp-node`, `hkp-python`, `hkp-rt`, `hkp-frontend` | M | ☐ |
| **R1b** | Built-in coordinator identity (self-issued RS256 JWKS via Passkeys / SMTP magic link) | `hkp-node/src/coordinator`, `hkp-frontend` | L | ✎ |
| **R2** | Capability invite links & guest mode for shared boards (no external account required) | `hkp-node/src/coordinator`, `hkp-frontend/src/views/cloud` | M | ✎ |
| **R3** | Encrypted-at-rest runtime secret persistence across restarts (completing `TODO-SECRETS.md` Prio B) | `hkp-node`, `hkp-python`, `hkp-rt` (`coordinatorLinks`) | M | ☐ |
| **R4** | Live broadcast invalidation ("everyone, look again") for multi-user boards | `hkp-node/src/coordinator/bridge.ts`, `sql` service | S–M | ✎ |
| **R5** | Turnkey self-hosting stacks (Compose + Caddy, YunoHost, Home Assistant, CLI init) | `hkp-node`, packaging | M | ☐ |
| **R6** | Full board + data archive export/import (`.readymade` bundle: board, members, SQLite, store) | `hkp-node/src/coordinator`, `hkp-frontend` | M | ✎ |
| **R7a** | Plain-language SQL & expression safety/caller-binding indicators in `reviewSummary.ts` | `hkp-frontend/src/assist/reviewSummary.ts` | S–M | ☐ |
| **R7b** | Parameterised domain blocks (`presets/sub-service/`) for common club/group patterns | `presets/`, `boards/` | M | ☐ |
| **R7c** | Interactive multi-member simulation in the playground before deploying | `hkp-frontend` | M | ✎ |
| **R8** | Provenance badges (reviewed core vs. board-authored) and declarative board scenario tests | `hkp-frontend`, `readymade-mcp`, `hkp-node/tests` | M | ☐ |

---

## 1. Sovereign identity & zero-account participation

### R1a — Standard OIDC discovery (`ISSUER_URL`)

**Why:** `hkp-node/src/auth.ts`, `hkp-python/src/hkp/auth.py`,
`hkp-rt/lib/src/http/auth.cpp` and `hkp-frontend` currently assume Auth0
(`AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, and `https://<domain>/.well-known/jwks.json`).
A club or small business self-hosting `hkp-node` still depends on an Auth0
tenant whenever it deploys a multi-user board (`$caller_email`, `members`).

**Plan:**
- Accept `ISSUER_URL` and `AUDIENCE` across `hkp-node`, `hkp-python`, `hkp-rt`
  and the frontend while keeping `AUTH0_DOMAIN` and `AUTH0_AUDIENCE` as
  supported aliases.
- Resolve `jwks_uri` (and frontend authorization/token endpoints) via standard
  `/.well-known/openid-configuration` discovery with a direct fallback to
  `/.well-known/jwks.json`.
- Test against a generic OIDC provider fixture (PocketID / Kanidm / Keycloak
  token shapes) in `auth-jwt.test.ts`, `test_auth.py` and `auth.test.cpp`.

### R1b — Built-in coordinator identity (Zero-IdP mode)

**Why:** Even standard OIDC requires running a separate identity provider. A
family or sports club running a single `hkp-node` instance should not need an
external IdP to verify member emails or sign in the owner.

**Plan:**
- When enabled on a coordinator (`hkp-node`), generate and persist an RS256
  signing keypair in `~/.hkp/node-<instance>/` (`0600`) and serve
  `/.well-known/jwks.json` directly from the coordinator.
- Offer two self-contained sign-in flows that mint standard RS256 JWTs with
  `sub`, `email`, `email_verified: true`, `iss` and `exp`:
  1. **Passkeys (WebAuthn)** for passwordless owner/member sign-in.
  2. **Email magic link / one-time code** sent through a configured SMTP
     transport.
- Because the tokens are standard RS256 JWTs, `hkp-python` and `hkp-rt` verify
  them with the existing verifier pointed at the coordinator's JWKS URL.

### R2 — Capability invite links & guest mode

**Why:** As noted in `TODO-BOARD-MEMBERS.md` and `TODO-PITCH-SHOWCASE.md`,
answering a dinner poll or booking a court currently requires every participant
to hold an account. For casual groups, account creation is the main barrier.

**Plan:**
- **Per-member capability links:** Allow the board owner in `MembersDialog.tsx`
  to mint an invite link per member entry (`/cloud-boards?shared=…&invite=<token>`).
  Store only the SHA-256 hash of the token in `PersistedBoard` beside
  `{ email, name }` (matching the ticket model in `participants.ts`).
  Attaching over `/coordinator/bridge` with a valid invite token authenticates
  the bridge as that member (`RunActor { kind: "person", role: "member", … }`).
  Removing the member or rotating their link closes their bridges (`4403`).
- **Guest role (`G10` in `TODO-WORKFLOW-PLATFORM.md`):** Allow a board to opt
  into unauthenticated facade access for actions explicitly marked as
  guest-callable, running under `RunActor { kind: "guest" }` with per-address
  rate limits.

---

## 2. Operational resilience & zero-friction self-hosting

### R3 — Runtime secret persistence across restarts

**Why:** Today (`docs/content/concepts/cloud-boards.md`, *Known gaps*), tickets
survive a runtime server restart, but secret values handed over during the
coordinator introduction live only in memory. After a power cut or OS reboot on
a club server, boards using IMAP, SMTP, HTTP credentials or model keys stay in
`needs configuration` until the owner re-deploys from their browser.

**Plan:**
- Complete `TODO-SECRETS.md` Prio B: persist scoped secret values encrypted at
  rest in the runtime server's instance directory (`~/.hkp/node-<instance>/`),
  bound to `(boardName, runtimeId, alias, audience)`.
- Reload them when a runtime server reconnects to its coordinator with its
  persisted ticket, so an unattended reboot recovers the full board without
  human intervention.

### R4 — Live broadcast invalidation on multi-user boards

**Why:** `person`-initiated notifications go only to that person's bridges
(`docs/content/concepts/cloud-boards.md`, *What is still open*). When member A
books a court or answers a poll, member B's open screen does not update until B
taps something.

**Plan:**
- Keep `person`-run notifications private by default.
- Add an explicit way for a state-changing step (or a pipeline completion) to
  trigger a `board`-actor refresh of a read service, or emit an invalidation
  signal that re-runs the facade's read query under `board` context so every
  connected member bridge receives its projected update in real time.

### R5 — Turnkey self-hosting packages

**Why:** `npx hkp-node` and the Docker images are easy for developers, but
setting up TLS, `EXTERNAL_HOST`, `ALLOWED_ORIGINS`, `HKP_EGRESS=public` and
systemd/volumes is too much friction for a non-technical club admin.

**Plan:**
- Ship a turnkey `docker-compose.yml` pairing `hkp-node` (coordinator +
  runtime) with Caddy for automatic TLS and safe defaults (`HKP_EGRESS=public`,
  named instance volume).
- Provide `hkp-node init` (interactive CLI setup) that writes the configuration
  and displays a connection QR code for the Readymade desktop/mobile app.
- Prepare community app-store manifests for popular home/association servers
  (YunoHost, Cloudron, Home Assistant add-on, Umbrel).

### R6 — Complete board + data archive export and import

**Why:** Exporting a board JSON and exporting a `.sqlite` file are currently
separate steps, and a deployed board's member list and `store` records stay on
the coordinator/runtime server (`docs/content/concepts/remotes.md`). True data
sovereignty means a club or business can move a live deployed board — logic,
members and data together — between their own machine and any hosted coordinator
in one step.

**Plan:**
- Add an owner-only archive export/import on the coordinator that bundles:
  - `board.json` (descriptor, blocks, assets),
  - `members.json` (member list),
  - board-scoped SQLite database files and `store` records.
- Verify integrity and tenant scoping on import so restoring an archive never
  overwrites another board's storage.

---

## 3. Non-coder legibility & behavioral verification

### R7a — Plain-language invariant & caller-binding indicators in review

**Why:** `hkp-frontend/src/assist/reviewSummary.ts` counts the lines of
`AUTHORED_KEYS` (`statement`, `schema`, `expression`, `prompt`) so the user sees
what is new versus what is built from existing blocks. However, a non-coder
cannot read 100 lines of SQL to check whether a statement safely enforces caller
identity (`TODO-GOLDEN-PATH-VIDEO.md`, rule 4).

**Plan:**
- Extend `reviewSummary.ts` and `BoardAssistPreview.tsx` with deterministic
  inspection of authored `sql` statements and `map`/`filter` expressions:
  - **Caller-bound write:** highlights whether `INSERT` / `UPDATE` / `DELETE`
    statements reference `$caller_email`, `$caller_sub` or `$caller_role`.
  - **Unscoped mutation warning:** flags `UPDATE` or `DELETE` statements that
    do not bind a caller identity or role check.
  - **Read-only badge:** marks pure `SELECT` statements so the reviewer knows
    they cannot alter stored data.

### R7b — Parameterised domain blocks for recurring group rules

**Why:** Every line of logic moved into a human-reviewed, parameterised block
(`TODO-BLOCKS.md`) is a line a non-coder does not have to review when building
with AI.

**Plan:**
- Expand `presets/sub-service/` with reviewed, tested building blocks for
  recurring organisational tasks:
  - slot/resource booking with per-member limits,
  - date/option polling with open/closed state,
  - human-in-the-loop approval queue (`store` lease/ack),
  - shared expense splitting.
- Expose only plain parameters (`maxPerDay`, `requireRole`, `options`) on the
  block use's bar, reducing newly authored SQL in typical club/family boards
  towards zero.

### R7c — Interactive multi-member simulation in the playground

**Why:** Observability lets non-coders verify a solution by watching how it
behaves (`overview/`, Flow Inspector, Capture mode). Today, testing how a board
behaves when *two different members* interact with it (e.g. a booking conflict
or payer-only deletion) requires deploying to a coordinator with multiple
accounts.

**Plan:**
- Add a lightweight **Act as…** switcher in the playground toolbar when a board
  uses `$caller_*` or `$user`: let the author switch between simulated callers
  (e.g. *Owner (Sam)*, *Member (Ana)*, *Member (Ben)*) locally in the browser
  and watch the Flow Inspector and facade react before deploying.

---

## 4. Community adoption & ecosystem trust

### R8 — Provenance badges and declarative board conformance tests

**Why:** Non-coders rely on human experts having reviewed the base components
and blocks they compose. Making that review boundary visible in the UI — and
easy to test in CI when community members contribute new blocks or boards —
scales trust.

**Plan:**
- **Provenance in the UI:** Use the commit/hash provenance model from
  `readymade-mcp` to distinguish unmodified shipped services and library blocks
  from custom or AI-edited configurations in the Overview and Review Summary.
- **Declarative board conformance tests:** Standardise a lightweight test helper
  (following `hkp-node/tests/court-booking-board.test.ts` and
  `rss-radio-board.test.ts`) so every community-contributed board or block can
  ship with a readable multi-actor test script verified in CI.

---

## Suggested sequence

1. **Immediate (low friction, immediate user value):**
   - **R7a** — SQL caller-binding and mutation badges in `reviewSummary.ts` and
     `BoardAssistPreview.tsx`.
   - **R1a** — Generalise `auth.ts` / `auth.py` / `auth.cpp` to accept standard
     OIDC `ISSUER_URL` discovery alongside `AUTH0_DOMAIN`.
2. **Next (removing everyday group friction):**
   - **R2** — Capability invite links for board members.
   - **R3** — Encrypted-at-rest runtime secret persistence across restarts.
   - **R4** — Live broadcast invalidation for shared boards.
   - **R7c** — Local multi-member switcher ("Act as…") in the playground.
3. **Follow-up (scaling self-hosting and library reuse):**
   - **R1b** — Built-in coordinator identity (Passkeys / magic link).
   - **R5 & R6** — Turnkey self-hosting stacks and full board + data archive
     export/import.
   - **R7b & R8** — Reviewed domain blocks library and provenance badges.
