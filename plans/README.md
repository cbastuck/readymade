# Plans

Working documents for changes that span more than one session: what was decided,
why, and what is still open. They are not documentation — the docs
(`docs/content/`) describe what the system *does*, these describe what it is
*meant to become*. When a plan lands, its conclusions move into the docs and the
plan is deleted.

| Document | What it covers | State |
| --- | --- | --- |
| [TODO-ASSETS.md](TODO-ASSETS.md) | Content (pages, scripts, samples, models) declared once in a board as inline text, base64 or a URL, and referenced from service state as `hkp-asset://id`; each runtime resolves at point of use from a pushed asset store; its own board view for editing | built 2026-09-30 across browser, hkp-node, hkp-python and hkp-rt; Make asset, s3, host-local upload and model loaders open |
| [TODO-BLOCKS.md](TODO-BLOCKS.md) | Services defined once in a board and used by reference: frozen uses, params, detach, towards presets | built 2026-09-26; a few gaps and open questions left |
| [TODO-CLOUD-COORDINATOR.md](TODO-CLOUD-COORDINATOR.md) | A coordinator, not a browser tab, owns a deployed board and provisions its runtimes | decided Aug 2026; partly built |
| [TODO-CONSOLIDATION.md](TODO-CONSOLIDATION.md) | Aligning service ids and contracts across runtimes, so a mismatch is reported rather than absorbed | open |
| [TODO-COORDINATOR-CONNECTIONS.md](TODO-COORDINATOR-CONNECTIONS.md) | Participants connect to the coordinator, which never dials; a board names a remote or a requirement, resolved by the person's client | built 2026-10-01 for hkp-node, hkp-python and the frontend; hkp-rt and a few questions open |
| [TODO-DEBUGGING.md](TODO-DEBUGGING.md) | Stopping a running board and walking it one invocation at a time, from the overview | designed, not built |
| [TODO-LIVE-STREAM.md](TODO-LIVE-STREAM.md) | Microphone streamed live as MP3 from hkp-rt: the realtime handoff, a stream encoder, an endpoint's stream, a low-latency player page, and a cloud relay on hkp-node — chained through the board, or fed directly over a WebSocket | built 2026-09-27/28 on macOS; bytes over the chain done, direct variant recomposition, measurements, wss and other targets open |
| [TODO-QUEUE.md](TODO-QUEUE.md) | The `queue` service and what board units still need from it | service built; units open |
| [TODO-SCOPES.md](TODO-SCOPES.md) | SubService as a boundary: stopping propagation, slots, dotted addressing | designed 2026-09-20, not built |
| [TODO-SECRETS.md](TODO-SECRETS.md) | Secrets resolved at point of use and bound to a destination | Prio A built; Prio B open |
| [TODO-TIMELINE.md](TODO-TIMELINE.md) | A timeline animating one object by keyframes, driven by time as a value; nested timelines and blocks composing one animation on one canvas | decided 2026-09-26; service, keyframes, UI, placements and demo board built |
| [TODO-TEST.md](TODO-TEST.md) | Manual per-change test checklists that the automated suites do not cover | living checklist |
| [TODO-WORKFLOW-PLATFORM.md](TODO-WORKFLOW-PLATFORM.md) | Stateful, human-in-the-loop business-process boards — the gaps G1–G13 and their phases | in progress |

How the system works *today* is documentation, not a plan: see
`docs/content/concepts/` — for this area, **Cloud boards**
(`docs/content/concepts/cloud-boards.md`), **Coordinator**
(`docs/content/concepts/coordinator.md`) and **Remotes**
(`docs/content/concepts/remotes.md`).
