# Plans

Working documents for changes that span more than one session: what was decided,
why, and what is still open. They are not documentation — the docs
(`docs/content/`) describe what the system *does*, these describe what it is
*meant to become*. When a plan lands, its conclusions move into the docs and the
plan is deleted.

**These plans are public**, as the rest of this repository is: they record why
the system is built the way it is, for anyone working on it. Three kinds of
content do not belong here, and go to `private-plans/` beside the checkout
(`../private-plans/` from the repository root), a private repository of its own:

- **Commercial and legal terms** — contract text, prices and deal terms not yet
  decided, the entity and tax questions behind them.
- **Security weaknesses not yet fixed** — a finding's details stay private until
  it is done; the write-up of what was changed may then be published.
- **Personal data** — about anyone: customers, members, the people in a demo.

A public plan may say that such a part exists and where it is kept; it never
repeats what it says.

| Document | What it covers | State |
| --- | --- | --- |
| [TODO-EARLY-ADOPTERS.md](TODO-EARLY-ADOPTERS.md) | The pricing page's "Early adopter? Say hello" field for offers not open yet, kept by a deployed Readymade board: one field per offer, double opt-in, unsubscribe, privacy policy | decided 2026-11-08; placeholder on the page (stores nothing), board not built |
| [TODO-E2E.md](TODO-E2E.md) | E2E implementation milestones: reliable fixtures, PR/cloud CI, board journeys, authenticated sharing/secrets, distributed recovery, and native release checks | milestone 1 done; three clean default runs, diagnostics/cleanup verified, two application defects fixed; intermittent C++ in-process test crash recorded (likely the teardown race fixed in #43); milestone 2 done; hosted browser/Node checks green, failure artifacts verified; milestone 3 next |
| [REVIEW-V1-E2E-SECURITY.md](REVIEW-V1-E2E-SECURITY.md) | The v1 review: ten security findings ordered by severity, E2E coverage and test-infrastructure proposals. Its Progress table says which finding is being worked on and which are done | reviewed 2026-10-06, revised 2026-10-09; findings 1–5, 7 and 8 done (1, 3 and 4 passed by hand 2026-11-08); 6, 9 and 10 in progress, kept outside this repository until done |
| [TODO-ASSETS.md](TODO-ASSETS.md) | Content (pages, scripts, samples, models) declared once in a board as inline text, base64 or a URL, and referenced from service state as `hkp-asset://id`; each runtime resolves at point of use from a pushed asset store; its own board view for editing | built 2026-09-30 across browser, hkp-node, hkp-python and hkp-rt; Make asset, s3, host-local upload and model loaders open |
| [TODO-BLOCKS.md](TODO-BLOCKS.md) | Services defined once in a board and used by reference: frozen uses, params, detach, towards presets | built 2026-09-26; a few gaps and open questions left |
| [TODO-BOARD-MEMBERS.md](TODO-BOARD-MEMBERS.md) | A deployed board with one owner and a list of members who may attach and use its facade; a run actor stated by the server that verified a person, down to a service; process calls over the bridge | built 2026-10-05 across hkp-node, the frontend, hkp-python and hkp-rt; the two-person pass by hand and the open questions remain |
| [TODO-CAPTURE-MODE.md](TODO-CAPTURE-MODE.md) | What a call report carries: values only while Capture mode is on, never saved, and never more than 5 MiB of one — data inside a run is private, only what a board outputs is public | decided and built 2026-10-25 across the four runtimes, the coordinator and the frontend; the pass by hand, services' own notifications and the vocabulary entry open |
| [TODO-CLOUD-COORDINATOR.md](TODO-CLOUD-COORDINATOR.md) | A coordinator, not a browser tab, owns a deployed board and provisions its runtimes | decided Aug 2026; partly built |
| [TODO-CONSOLIDATION.md](TODO-CONSOLIDATION.md) | Aligning service ids and contracts across runtimes, so a mismatch is reported rather than absorbed | open |
| [TODO-COORDINATOR-CONNECTIONS.md](TODO-COORDINATOR-CONNECTIONS.md) | Participants connect to the coordinator, which never dials; a board names a remote, resolved by the person's client | built 2026-10-01 for hkp-node, hkp-python and the frontend; hkp-rt and a few questions open |
| [TODO-DEBUGGING.md](TODO-DEBUGGING.md) | Stopping a running board and walking it one invocation at a time, from the overview | designed, not built |
| [TODO-HKP-RT-COORDINATOR-LINK.md](TODO-HKP-RT-COORDINATOR-LINK.md) | Closing cloud boards as one package: binary data across a deployed board, hkp-rt as a participant, a standalone hkp-rt with auth, open binding and a Docker image, and how it is all tested | built 2026-10-02; manual pass (incl. running the image) and mounts-in-the-apps open |
| [TODO-GOLDEN-PATH-VIDEO.md](TODO-GOLDEN-PATH-VIDEO.md) | An explainer filmed from the real app: a sentence to the board assistant, a reviewed board, a deployment, a member booking on a phone, the booking seen in the service — and the fixes each beat needs first | planned 2026-10-20; built and filmed (P1–P9: usage and price per turn, the review summary, real sign-in with harness identities, the two-person pass, Runs on a deployed board, the recorded assistant run), Shared Costs filmed as a second story; open: a comparison figure, shooting on the hosted deployment, a real phone, the owner's name, and a toolbar that retracts by itself |
| [TODO-FACADE-BINDINGS.md](TODO-FACADE-BINDINGS.md) | Making a facade observable: each widget's "Acts on" / "Updated by" bindings in an overlay in the board + facade view and in the facade editor, with Show in board and Inspect; facade state looked at any time; then run origin and configure events in the flow inspector | planned 2026-11-13; steps 1–6 and 6b built (bindings, where a service lives, one shared reveal with Inspect, the widget badge and overlay, the facade badge on the divider, facade state with its history and writers, the same in the facade editor); steps 7–9 open |
| [TODO-LIVE-STREAM.md](TODO-LIVE-STREAM.md) | Microphone streamed live as MP3 from hkp-rt: the realtime handoff, a stream encoder, an endpoint's stream, a low-latency player page, and a cloud relay on hkp-node — chained through the board, or fed directly over a WebSocket | built 2026-09-27/28 on macOS; bytes over the chain done, direct variant recomposition, measurements, wss and other targets open |
| [TODO-MCP-KNOWLEDGE.md](TODO-MCP-KNOWLEDGE.md) | An offline-first, versioned Readymade knowledge layer exposed through MCP, with structured service contracts, compatibility/example lookup, validation and pinned source inspection | local server, optional Board Assist adapter and Anthropic richer-tool discovery built; OpenAI tool discovery and provenance UX next |
| [TODO-MOBILE-PARITY.md](TODO-MOBILE-PARITY.md) | Bringing the desktop features to iOS and Android: pinning a board to the Home Screen, native board storage shared with the Mac, presets, blocks and Run, the flow inspector and Capture mode, secrets, Board Assist, assets, licenses, sharing in | planned 2026-10-26; M1 (Home Screen pins), M2 (native storage, iCloud, history) and M3 (presets, blocks, Run) built, their passes on devices open; multi-pipeline services on a phone found unreachable; the rest open |
| [TODO-PITCH-SHOWCASE.md](TODO-PITCH-SHOWCASE.md) | The pitch's gallery of starting points in shelves, a slide for building with AI and its two claims, the commercial track on the Cloud + Partner frame, and bringing in HN Reader and OpenCode | drafted 2026-11-06; commercial slides in the deck and the pricing page public, the gallery component built, OpenCode on the branch, Court Booking, Meeting Poll, Health Log, HN Reader, Live Radio and RSS Radio shot; open: AI Collaboration's shoot, OpenCode's usage count, the gallery and AI slide still development-only, public demos |
| [TODO-QUEUE.md](TODO-QUEUE.md) | The `queue` service and what board units still need from it | service built; units open |
| [TODO-RADIO-LANES.md](TODO-RADIO-LANES.md) | The Reading Radio as five swimlanes following an article from feed to audio: each unit's own table in one shared database, failures recorded as data (Join `onFailure: "merge"`), Retry as a card button instead of a timer, and what the swimlane widget needs for it | planned and built 2026-11-07, all eight steps, and the Reading Radio film re-shot on the lanes; open questions: a failure value, dropping an article already briefed, the size of Items, refresh by push, missing secrets |
| [TODO-SCOPES.md](TODO-SCOPES.md) | SubService as a boundary: stopping propagation, slots, dotted addressing | designed 2026-09-20, not built |
| [TODO-SECRETS.md](TODO-SECRETS.md) | Secrets resolved at point of use and bound to a destination | Prio A built; website has an interim page-memory store (B0); Prio B open |
| [TODO-TIMELINE.md](TODO-TIMELINE.md) | A timeline animating one object by keyframes, driven by time as a value; nested timelines and blocks composing one animation on one canvas | decided 2026-09-26; service, keyframes, UI, placements and demo board built |
| [TODO-WORKFLOW-PLATFORM.md](TODO-WORKFLOW-PLATFORM.md) | Stateful, human-in-the-loop business-process boards — the gaps G1–G13 and their phases | in progress |

How the system works *today* is documentation, not a plan: see
`docs/content/concepts/` — for this area, **Cloud boards**
(`docs/content/concepts/cloud-boards.md`), **Coordinator**
(`docs/content/concepts/coordinator.md`) and **Remotes**
(`docs/content/concepts/remotes.md`).
