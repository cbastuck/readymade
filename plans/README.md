# Plans

Working documents for changes that span more than one session: what was decided,
why, and what is still open. They are not documentation — the docs
(`docs/content/`) describe what the system *does*, these describe what it is
*meant to become*. When a plan lands, its conclusions move into the docs and the
plan is deleted.

| Document | What it covers | State |
| --- | --- | --- |
| [TODO-BLOCKS.md](TODO-BLOCKS.md) | Services defined once in a board and used by reference: frozen uses, params, detach, towards presets | built 2026-09-26; a few gaps and open questions left |
| [TODO-CLOUD-COORDINATOR.md](TODO-CLOUD-COORDINATOR.md) | A coordinator, not a browser tab, owns a deployed board and provisions its runtimes | decided Aug 2026; partly built |
| [TODO-CONSOLIDATION.md](TODO-CONSOLIDATION.md) | Aligning service ids and contracts across runtimes, so a mismatch is reported rather than absorbed | open |
| [TODO-DEBUGGING.md](TODO-DEBUGGING.md) | Stopping a running board and walking it one invocation at a time, from the overview | designed, not built |
| [TODO-QUEUE.md](TODO-QUEUE.md) | The `queue` service and what board units still need from it | service built; units open |
| [TODO-SCOPES.md](TODO-SCOPES.md) | SubService as a boundary: stopping propagation, slots, dotted addressing | designed 2026-09-20, not built |
| [TODO-SECRETS.md](TODO-SECRETS.md) | Secrets resolved at point of use and bound to a destination | Prio A built; Prio B open |
| [TODO-TEST.md](TODO-TEST.md) | Manual per-change test checklists that the automated suites do not cover | living checklist |
| [TODO-WORKFLOW-PLATFORM.md](TODO-WORKFLOW-PLATFORM.md) | Stateful, human-in-the-loop business-process boards — the gaps G1–G13 and their phases | in progress |

How the system works *today* is documentation, not a plan: see
`docs/content/concepts/` — for this area, **Cloud boards**
(`docs/content/concepts/cloud-boards.md`) and **Coordinator**
(`docs/content/concepts/coordinator.md`).
