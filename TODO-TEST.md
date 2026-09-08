Tier 1 — extensive testing (rewritten)

These three are where I'd concentrate effort. Everything else is a regression check.

peer-server (hkp-node) — largest change

Entirely reimplemented: no port bind, PeerJS mounted at an assigned path, WS upgrades routed manually via the createWebSocketServer hook.

- [x] Board peer-chat-node-board.json loads; Peer Server state shows a url and path of /hosted/<32 hex> — not a port
- [x] Peer Events monitor fires on peer connect/disconnect (emitEvents still works)
- [x] Two browsers on the same board can exchange chat messages end-to-end
- [x] GET <url>/peerjs/peers returns the peer list (drives the UI's peer dropdown)
- [x] Toggle bypass on → off → on: endpoint stops serving, then serves again at a new URL
- [x] While Peer Server is active, the runtime's own notification WebSocket still works — monitors keep updating. (This is the one I'd hammer: it's the shared-upgrade path.)
- [x] Close the board / last tab → mount URL 404s

http-server-subservices (hkp-node)

- [x] Endpoint reachable at the published url; port in state is gone
- [x] Path routing: GET <url>/foo/bar reaches the pipeline as path: "/foo/bar" — the mount prefix must be stripped
- [x] Query strings and non-GET methods behave
- [ ] Both modes: process_on_session and process_on_data
- [x] Response body is the pipeline output; downstream outer services still receive it
- [ ] An old board carrying "port": 8090 loads without error and ignores the port

peer-socket (hkp-frontend)

New peerMount reference + lazy resolution + retry.

- [x] Connects on a cold board load (the concurrent-restore race — reload several times)
- [x] Connects when the browser runtime is listed before the REST runtime in the board
- [ ] UI shows "<ref> (waiting for endpoint)" briefly, then the resolved ws://… URL
- [x] Typing a manual server URL into the PeerJS Server field overrides the reference (this clears peerMount; if the typed value appears ignored, that's the bug)
- [x] Point peerMount at a nonexistent service → error notification after ~15s, no hang
- [ ] A board with the old peerPort/peerPath/peerHost fields and no peerMount still connects to an external PeerJS server

---

Tier 2 — tenancy regression (unchanged code, re-routed call paths)

Every service now resolves through a tenant lookup. Config A, one board at a time:

- [x] monitor, map, timer, sub-service — add / configure / reorder / remove
- [x] imap-email (imap-email-demo-board.json), smtp-email (smtp-email-demo-board.json), telegram-listener, telegram-sender

For the four credential-holding services specifically:

- [ ] Configure a secret, then re-read state → masked ("" + …Configured: true)
- [ ] Re-submit the form without retyping the secret → secret is not wiped, service still connects

Board lifecycle:

- [ ] Reload the page with a hkp-node board → reattaches to the existing runtime; a running Timer keeps its counter (this is the POST /runtimes reuse path)
- [ ] Clear board / DELETE /runtimes → your runtimes go away
- [ ] Rearranging services persists

---

Tier 3 — two-user isolation (config B)

- [x] Both users load the same board (e.g. peer-chat-node-board.json, runtime id chat-node) simultaneously → each gets their own runtime with their own services. Neither sees
      the other's monitor output.
- [x] Each user's Start page → Remotes folder lists only their own runtimes
- [x] User A clears their board → user B's board keeps running
- [x] Both run a Peer Server at once → two distinct mount URLs, both live (this is the case that was impossible with ports)
- [ ] User A configures IMAP credentials; user B cannot see or operate that service

---

Tier 4 — frontend surfaces

- [ ] Facade widgets targeting a REST service (button, knob, text-input with a serviceUuid on the hkp-node runtime). This was broken before my fix — it sent no Authorization
      header — so under config B it should now work where it previously 401'd silently. Worth confirming it genuinely works, not just that it stopped erroring.
- [ ] Start page → Remotes → drill into a runtime → service list renders
- [ ] Adding a remote via Manage Remotes, then attaching
- [ ] Cloud boards (COORDINATOR_ENABLED=true) — provision a board, confirm it runs, then close the browser and confirm teardown. This exercises the session-token path, whose
      cleanup sweep I changed to filter by owner.
