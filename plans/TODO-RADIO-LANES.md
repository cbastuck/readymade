# Radio lanes: the Reading Radio as one board you can watch

Planned 2026-11-07; steps 1 and 2 built the same day (see *Progress*). Replaces the composed Reading Radio's facade —
one tab per unit, each with a refresh button — with five swimlanes that follow
an article from its feed to the audio it became.

---

## The problem

The Reading Radio works and cannot be understood while it runs. A session spent
getting one article briefed (2026-11-07) turned up, in order: a wrong API key, a
`temperature` the model refused, a token budget the model's thinking used up, and
an article that had silently spent all three of its retries — and **none of it
was visible on the board**. What the board showed instead:

- **Every unbriefed article said "Reading…"**, including thirteen from two weeks
  earlier that no feed would ever offer again. The status query could not tell
  "being read" from "abandoned".
- **A given-up article said "Could not be fetched"**, whatever had actually
  failed. The fetch was fine; the brief was not.
- **A failure left no trace a person could find.** A failed step stops the run
  and notifies; nothing is recorded, and the editor's facade raised no notice for
  the step that failed (added since, for the brief only).
- **Retries happened on a timer nobody could see** — again after fifteen
  minutes, at most three times — and a reload, which empties the website's
  in-memory secrets, spent one of them.
- **"Read now", "Refresh the desk", "Refresh the programme"** looked necessary
  and were not: every one of them does what a one-minute timer does anyway.

Readymade's claim is that a board is observable — that the person who built it
can see what it is doing and fix it. Here they could not, and a session with the
code open was needed to say why.

---

## The board, as lanes

One facade, five lanes, one card per article. A card is in exactly one lane, and
the lane *is* its state; a card's face says what is happening to it there.

| # | Lane | A card here is | Arrives by | Leaves by | A person can |
|---|---|---|---|---|---|
| 1 | **Sources** | a feed the reader subscribes to | being added | being removed | add a feed (create), unsubscribe (delete) |
| 2 | **Items** | an article in any subscribed feed, not yet kept | the reader fetching its feeds | being kept | drag it to Reading list |
| 3 | **Reading list** | a kept article being briefed, or whose brief failed | a person keeping it | its brief being written, or a person taking the feed's line instead | on a failed brief: **Retry**, or **Use the feed's line**; drag it back to Items to drop it |
| 4 | **Briefed** | an article with its brief (or its feed's line), being voiced, or whose audio failed | its brief being written | its audio being stored | read the brief; **Retry** failed audio |
| 5 | **On air** | an article with its audio | its audio being stored | being forgotten | play it (a player on the card), read the brief, forget it |

Only the move from 2 to 3 (and back) is a person's; every other move is the
system's, and those lanes neither offer their cards for dragging nor accept drops
(`allowDrag` / `acceptDrops`, which the widget already has).

**Within a lane, a card says one of three things:** *waiting* (here, not yet
started), *working* (started, not finished — with since when), or *failed* (with
the reason the service gave, and a Retry). Done is not a state a card shows; done
is the next lane.

The units keep their own facades. Each unit still runs, and is tested, as a
board on its own; what changes is the composition's facade, which stops being a
tab per unit and becomes the lanes.

---

## Decisions

### 1. Where an article's stage is known: each unit's own table, in one shared database

A lane is a query, and lanes 3–5 are about an article's progress through three
units — reader, editor, radio — each of which keeps its own database today and
knows nothing of the others. Three ways to give a lane a source:

| | How | For | Against |
|---|---|---|---|
| A. Units as they are | each lane reads the unit responsible for it | units unchanged | lanes cannot join across databases, so a card is in no lane while it waits for the next unit to poll — up to a minute, every hand-off |
| B. One table | reader, editor and radio share one table with `stage` and `error` | trivial lanes, no gaps | the units stop being units: the editor no longer works on "any feed" |
| **C. One database, own tables** | **each unit keeps its own table, and the composition names the same `database` for all three** | lanes join; every unit still runs alone, on its own database, with its contract unchanged | table names must not collide; a unit's table becomes something another query reads |

**Chosen: C.** It is the arrangement the Reading Radio already uses for audio —
the radio and the library share bytes by naming the same volume — applied to
rows. A unit alone gets the database its own param names; composed, the three
name one. Nothing about the feeds between them changes, so each unit's contract
("give me a feed, I publish a feed") stands.

What it takes:

- **Table names that do not collide.** The reader and the editor both call
  theirs `article`. The editor's becomes `brief`; the reader keeps `article`, the
  radio keeps `episode`. Existing editor databases are demo data and are not
  migrated.
- **A common key.** All three already identify an article by its link: the
  reader keys by `link`, the editor's `guid` is the feed item's id, which the
  reader's feed sets to the link, and the radio keeps `link` beside its slug.
  The lanes join on `link`, and each unit's table gets an index on it.
- **Lane queries in the composition**, in a runtime of its own (`desk`), not in
  any unit: they are about the composition, which is the only thing that knows
  the three tables are side by side.

### 2. A failure is data, not only a notification

A card can only say "failed: no value stored for anthropic.key" if the reason was
recorded somewhere a query reads. Today a failing service returns `null` and
notifies `{error}`; the run stops, and the reason exists only in a notification
nobody may be listening to.

**Join learns to report a failed detour beside the article** instead of stopping:

```json
{ "serviceId": "join", "state": { "as": "brief", "onFailure": "merge" } }
```

With `onFailure: "merge"`, a detour that ends with nothing *because a service in
it failed* passes the article on with `brief: { "error": "…", "service": "write" }`
beside it; one that ends with nothing because a service *chose* to stop (a
filter, a claim that skipped) still stops, as today. The default, `"stop"`, is
today's behaviour, so no board changes meaning.

How Join tells the two apart: a failing service notifies `error` during the run,
and Join already runs its detour as a child of the current run, so it hears its
own detour's notifications by run context and nobody else's. That works with
every existing service unchanged. The alternative — a failure *value*, a data
type beside `Null` and `ControlFlowData` that a service returns instead of
`null` — is cleaner and would let any service, not only Join, branch on a
failure; it is also a change to every runtime's type system and to every
service that fails. Kept as an open question; Join first.

A failure recorded by the board, then, is one step after the detour: a map that
routes `brief.error` to `UPDATE brief SET failed = datetime('now'), error = $error`
instead of to the step that keeps the brief.

### 3. Retry is a button, not a timer

The timers stay for moving *new* things forward: the editor and the radio still
look for work every minute. What goes is the automatic retry: no `retryAfter`, no
`tries`. A step that failed stays failed, on its card, with its reason, until a
person presses Retry. "Failed, and says why" is a state a person can act on;
"may try again in fifteen minutes, up to three times" is one they have to
reverse-engineer.

**Per stage, one table carries the state:** `started`, `finished`, `failed`,
`error`. The card's state is derived, never stored twice:

| `finished` | `failed` | `started` | Card says |
|---|---|---|---|
| set | — | — | (next lane) |
| — | set | — | failed: `error` |
| — | — | older than the stage's timeout | failed: no answer since `started` |
| — | — | set | working, since `started` |
| — | — | — | waiting |

The third row is a run that died mid-way — a restarted runtime, a killed
process. Without it a card would say "working" forever; with it the card turns
into a failure a person can retry. The timeout is a stage param (a brief: two
minutes; audio: ten).

**The claim changes with it:** take an article that has no row, and nothing else.
A row that exists is either done, working, or failed, and only Retry moves a
failed one.

**Retry** clears `failed` and `error`, sets `started`, and runs that one article
through the unit's per-item pipeline — a `process` at the scoped address of the
iterator's first step (`each.name`), with the card's row as the item. Scoped
processing is already built (`SubService.processNested`). The editor's row keeps
everything the pipeline needs to start again (title, link, blurb, feed,
published); the radio's will need the same.

**A failed brief also offers "Use the feed's line"** (decided 2026-11-07). It is
today's give-up, made a person's choice instead of the third retry's: the brief
becomes the line the feed gave (`blurb`), the row is `finished`, and the article
moves on to Briefed and the radio like any other. A page that will never be
readable — a paywall, a site that refuses the fetch — is not a reason to keep an
article off the air, and a person can tell that from the error where a retry
count cannot. The row says which it was (`source = 'feed'` rather than
`'model'`), so the Briefed card and the editor's published feed can both show
that this is the feed's own line, not a brief. Nothing does this by itself: a
failure that nobody acts on stays a failure, on its card.

### 4. What the swimlane widget needs

It shows a card's title and description, and lanes can create, edit, delete and
move. The lanes above also need:

- **A status on the card**: a field naming the state, a tone per state
  (`working` amber, `failed` red), and a line for the detail — the error, or
  "since 14:33".
- **Buttons on the card**, with `{{item.*}}` interpolation like every other
  action list, each shown only when a field has a value (`Retry` and `Use the
  feed's line` when `failed`).
  `cardActions: [{ label, actions, visibleWhen: { field, equals } }]`.
- **An audio player on the card**, from a field holding the address, for lane 5.
  The page's one-at-a-time rule (a card starting stops the one playing) is the
  `audio-player` widget's, and should be the same here.

Those are generic: a kanban of anything with a status, a failure and a retry is
most workflow boards (`TODO-WORKFLOW-PLATFORM.md`).

### 5. No refresh buttons

A lane's query runs again when its stage can have changed — after every step a
unit's pipeline records, and on a short tick (five seconds, a SQLite read) for
what changes without the composition hearing of it. "Read now" survives once, on
the Sources lane, as "Check feeds now", because a feed is the one thing that
changes somewhere else on its own schedule.

---

## Order of work

Each step is useful on its own, and the first two answer the question that
started this — *what is going on with this article* — before any lane exists.

1. **Join `onFailure: "merge"`** in hkp-node: hears its detour's `error` by run
   context, passes the article on with the failure beside it. Tests: a failed
   detour merges, a deliberate stop still stops, two overlapping runs do not hear
   each other's failures. Docs: `docs/content/services/join.md`.
2. **Editor records its failures and stops retrying by itself.** Table `brief`
   with `started` / `finished` / `failed` / `error`; claim only new articles; the
   brief detour on `onFailure: "merge"`; the derived state in the desk query;
   Retry (driving `each.name`) and Use the feed's line (a `source = 'feed'`
   update) as row actions on the editor's own facade. The editor alone is now
   debuggable.
3. **Swimlane card status, card actions, card audio** in the frontend, with
   tests and the swimlane widget docs.
4. **The composition shares one database**: the editor's table renamed, `link`
   indexed in all three, the `database` param set once for reader, editor and
   radio in `rss-radio-board.json`.
5. **The lanes facade, lanes 1–4**, with the `desk` runtime holding the lane
   queries; Sources and Items from the reader, Reading list and Briefed from the
   editor joined to the reader and the radio.
6. **The radio's turn**: the same failure, state and Retry treatment for the
   voice step; lane 5 with a player per card.
7. **Retire what the lanes replace**: the composition's unit tabs, the refresh
   buttons. Update `docs/content/boards/rss-radio-board.md`, and re-shoot the
   Reading Radio film (`e2e/film/rss-radio.film.ts`) and whatever the pitch
   showcase takes from it.
8. **hkp-python's Join** gets `onFailure` too, so the service stays one contract
   across runtimes (`TODO-CONSOLIDATION.md`).

---

## Progress

| Step | State |
|---|---|
| 1. Join `onFailure: "merge"` | **built 2026-11-07** in hkp-node (`src/services/join.ts`, `tests/join.test.ts`, `docs/content/services/join.md`) |
| 2. Editor records failures, no automatic retry | **built 2026-11-07** (`boards/rss-radio-editor-unit-board.json`, `hkp-node/tests/rss-radio-editor-board.test.ts`, the Editor section of `docs/content/boards/rss-radio-board.md`) |
| 3. Swimlane card status, actions, audio | **built 2026-11-07** (`SwimlaneRenderer.tsx`, `facade/types.ts`, `swimlaneCardState.test.tsx`, `swimlaneSources.test.tsx`, the swimlanes board page, `/new-board`) |
| 4. One shared database | **built 2026-11-07**: `reading-radio` for reader, editor and radio in `rss-radio-board.json` |
| 5. The lanes facade | **built 2026-11-07**, all five lanes |
| 6. The radio's turn | **built 2026-11-07**: failures recorded in a `voicing` table, no automatic retry, Retry on the radio's own facade and on Briefed cards, a player and Forget on On air cards (`boards/rss-radio-unit-board.json`, `hkp-node/tests/rss-radio-board.test.ts`) |
| 7. Retire what the lanes replace | **built 2026-11-07**: the units contribute no tabs (`"view": false`), the radio's refresh button is gone, docs updated. The film is re-shot on the lanes (`e2e/film/rss-radio.film.ts`, the pitch's `rss-radio.mp4`) |
| 8. hkp-python's Join | **built 2026-11-07** (`hkp-python/src/hkp/services/join.py`, `tests/test_join.py`) |

What step 2 did differently from the plan above:

- **The editor's table is already `brief`**, with `link` indexed — pulled forward
  from step 4, since step 2 reshaped the table anyway. Existing `article` tables
  in editor databases are left where they are, unread.
- **A page that cannot be fetched does not block the article.** The board's own
  rule — a page that cannot be read is briefed from the title and the feed's
  line — now covers a page that never answers too: the page detour merges its
  failure, the brief goes ahead, and the desk notes the page's problem beside
  the brief (`page_error`). Only the brief can fail an article, so only the brief
  has Retry and Use the feed's line. Re-fetching a page for a better brief is a
  possible follow-up, not a blocker.
- **The desk re-reads every ten seconds** (the `briefs` runtime's tick, which also
  rebuilds the published feed), and the Retry and feed's-line buttons re-read it
  as soon as they have run. "Refresh the desk" is gone; "Read now" is "Check the
  feed now".

What steps 3–5 added or did differently:

- **Two more swimlane fields**, because two lanes do not read the shared query:
  `allRows` (every row of the source is the lane's — the Sources lane reads the
  reader's list of feeds) and `except: { source, idField? }` (cards another
  source holds are left out — Items is the feeds' articles less those already
  in the lanes).
- **The editor's top-level services were renamed** (`edit-feed`, `edit-each`,
  `briefs-serve`, …): a composition's own facade addresses every unit's
  services by uuid, and the editor and the radio shared `feed`, `each`, `tick`,
  `end` and `pub-*`. The mount keeps its name (`briefs`), so its address does
  not move. The radio's names collide with the library's (`m3u-*`) still, which
  no lane needs. Addressing a unit's service from the composition by runtime as
  well as uuid would end the need for this; it is not built.
- **The lane query declares all three tables**, copied from the units, so the
  lanes work before any unit has run. A unit changing its table has to change
  the copy in `rss-radio-board.json` too.
- **The unit tabs stay** beside the lanes for now (step 7). The film saves its
  articles on the reader's tab, which it now opens first.
- **The demo-board restore test restores a composition with its units**, from
  the repository's boards, and expects its projection; until now a composition
  passed it by having no runtimes of its own.

What steps 6–8 did differently:

- **The radio's failures live in a table of their own**, `voicing`, beside the
  unchanged `episode` table. Adding columns to `episode` would have broken every
  radio database made before — the `schema` field creates tables that do not
  exist and never alters one that does — and the radio opened alone still reads
  its old database.
- **The radio branches with Tracks**, which the editor did not need: a voiced
  article has to be stored, a failed one recorded, and each track stops itself
  when it is not the one that applies.
- **The lanes re-read through a map** (`desk-base`) that hands the query the
  library's resolved address, so On air cards have something to play; every
  action re-enters there.

---

## Open questions

- **A failure value instead of Join listening for `error`** (decision 2). Worth
  it once a second service needs to branch on a failure.
- **Dropping an article that is already briefed or voiced** — dragging it from
  Reading list back to Items, or forgetting it in On air. Does its brief go, and
  its audio file? The radio's `forget` runtime already deletes an episode and its
  file; the editor has no equivalent.
- **The size of Items.** Four feeds of the reader's defaults are well over a
  hundred items; the lane wants a limit, newest first, and maybe a filter.
- **Lane refresh by push rather than a tick** — a unit's pipeline telling the
  composition a stage changed. Needs a way for a unit to say so without knowing
  it is composed.
- **Missing secrets** turn into a failure with a reason ("no value stored for
  anthropic.key") and a Retry, which is already better than a spent retry. The
  real answer, a run that does not start until its secrets are there, is
  `TODO-SECRETS.md` B3; and secrets that survive a reload on the website are its
  B0 follow-up.
