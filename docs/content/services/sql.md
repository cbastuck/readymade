# SQL

A board's own SQL database. Tables, columns and meaning all belong to the board.

---

## Available in

| Runtime | Service ID |
|---|---|
| Node.js (hkp-node) | `sql` |
| Browser | `sql` |

Both are SQLite and share one contract — modes, parameters, results — so a
statement written for one runs unchanged on the other. What differs is **whose
tables they are**: on hkp-node they belong to a tenant on a server, and every
person using the board sees the same rows; in the browser they belong to that
browser alone. See [In the browser](#in-the-browser).

---

## What it does

SQL runs statements against a database belonging to one board, and hands back
the rows. It knows SQL and nothing else — which is what makes it usable for a
workflow it has never heard of.

It is the companion to [Store](./store.md), not a replacement for it. Store keeps
records by key; that stops being reasonable the moment a board wants to ask a
question of them. *Every message in this conversation, oldest first* is a query,
and answering it by listing a whole namespace and filtering in an expression
falls over at a few hundred records.

Use Store when the board looks things up by name. Use SQL when it asks
questions.

### Which database a `sql` sees

The **tenant** comes from the runtime rather than from configuration, so no
board can reach another owner's tables by asking, and two people never share.
That isolation is one file per owner-and-database rather than a tenant column,
so it holds however a board writes its SQL: a statement that forgets its `WHERE`
still cannot reach anything outside its file.

**Which file** inside that tenant is the board's to say. `database` names it —
1–64 characters from `A–Z`, `a–z`, `0–9`, `-` and `_`, and not `shared`, which
is where the [Queue](./queue.md) keeps messages between boards. Services naming
the same file share its tables: within one board, which is the ordinary case, or
deliberately across boards, which is occasionally the point.

Left empty, the name is derived from the board's **title** — what every board
did before the field existed. That is convenient and it is also the sharp edge:
two boards that happen to share a title share their tables, and renaming a board
switches it to a different, empty file while its data stays under the old
title's name. A board that means to be alone with its data says so:

```json
"state": { "database": "syn-booking", "mode": "query", "statement": "…" }
```

A name that could mean somewhere else on disk is refused rather than quietly
replaced with the derived one — a silent fallback would hide the mistake behind
data that looks right until the day it doesn't.

---

## Modes

| Mode | What it does | Emits |
|---|---|---|
| `query` (default) | Runs a statement and returns its rows | `{ rows: [...], count }` |
| `run` | Runs a statement that changes rows | `{ changes, lastInsertRowid }` |
| `exec` | Runs statements for their effect — DDL, `PRAGMA`, several at once | `{ executed: true }` |
| `databases` | Lists the databases there are to name | `{ rows: [{ name, bytes }], count }` |
| `export` | Writes the whole database as SQL | the dump, as text |
| `import` | Runs SQL text arriving as **input** — a dump, typically | `{ executed: true }` |

`databases`, `export` and `import` need no `statement`. See
[Moving a database](#moving-a-database) for the last two.

---

## What travels onward

By default the result travels: a service asked a question hands on its answer,
and the next service reads rows.

`emit: "input"` passes the **input through untouched** instead. The statement
still runs and still reports what it did — it simply stays out of the way of the
flow. That is what lets several statements act on **one request** in turn:

```json
[
  { "uuid": "give-back", "state": { "mode": "run",   "emit": "input", "statement": "DELETE FROM booking WHERE $intent = 'cancel' AND …" } },
  { "uuid": "take",      "state": { "mode": "run",   "emit": "input", "statement": "INSERT INTO booking … WHERE $intent = 'book' AND …" } },
  { "uuid": "the-day",   "state": { "mode": "query",                  "statement": "SELECT … FROM booking WHERE day = $day" } }
]
```

One process call on `give-back` runs all three in the runtime's order. Each names
its parameters out of the same request, and the last one re-reads what the first
two changed — so the board gets the state *after* the change without a second
call, and without a refresh that could race the write.

Without it the second statement would be handed the first one's
`{ changes, lastInsertRowid }`, find none of the names it asked for, and bind
them all to `NULL`.

**Reporting is not passing on.** The statement's own result is notified either
way, so a service's panel shows what it did whatever the board does with it.

---

## Parameters come from the input

A board writes **no parameter list**. The statement names what it needs, and
those names are read off the input:

```json
{
  "mode": "run",
  "statement": "INSERT INTO mail VALUES ($messageId, $conversationId, $sentAt, $body)"
}
```

Given input `{ messageId: "a@x", conversationId: "root@x", sentAt: "…", body: "…", subject: "…" }`,
the four names the statement mentions are bound and `subject` is ignored —
SQLite rejects a parameter it was not asked for.

`$name`, `:name` and `@name` are all named parameters. Names inside string
literals and comments are not: `'anna@example.com'` is an address, not a
parameter called `@example`.

**Values are bound, never interpolated.** A subject line containing a quote is a
subject line — not a syntax error, and not an injection.

| Input value | Stored as |
|---|---|
| string, number | itself |
| `true` / `false` | `1` / `0` |
| object, array | its JSON |
| `undefined`, missing | `NULL` |

### Who is calling

Four names are **reserved**, and bound from the run rather than from the
input:

| Parameter | What it is |
|---|---|
| `$caller_email` | the caller's verified email, lowercased |
| `$caller_name` | what the board's member list calls them — set on a [shared, deployed board](../concepts/cloud-boards.md#sharing-a-board-members) |
| `$caller_sub` | the id their sign-in gives them |
| `$actor_kind` | `person`, `board`, `mount`, or `local` |

The caller is whoever began the run, **stated by the server that verified their
token**. Each is `NULL` when the run has no caller — a timer, a request at a
mount, a server running without authentication — or the caller has no such
value. An input field of the same name is ignored.

That is the point of reserving them: a payload naming its sender proves
nothing, and on a board several people use, "whose booking is this" cannot be
answered from the request. Reserved in the service rather than stamped onto
the input by a service placed in front, because a stamp can be walked around —
a process call that enters the pipeline *at* this service never passes the one
before it.

For identity-sensitive work, act only when the required caller value is
present. Do not fall back to an identity supplied in the input: an
local/auth-disabled client can choose that value itself.

---

## The schema

`schema` holds the `CREATE TABLE` statements the board needs. They are applied
**once per board, before the first statement runs** — not on configure, because
a service is configured before the runtime tells it which board it belongs to.

There is **no migration**. `CREATE TABLE IF NOT EXISTS` adds no column to a
table that already exists, and the schema is applied once per process. A board
whose tables have to change shape moves to a new table — and gives its indexes
new names too, since an index name is the database's, not the table's, and
`CREATE INDEX IF NOT EXISTS` would silently keep the old one.

Write it with `IF NOT EXISTS`, since it is applied to a database that may
already have been set up by an earlier run.

Any one `sql` service on the board can carry the schema; the rest see the tables
it created.

### Rules belong in it

A constraint is worth more than the `WHERE` clause that would have avoided
breaking it: a statement that declines to act is indistinguishable from one that
had nothing to do, while a refused one says so. Anything that goes wrong is
reported as `{ error }`, so a facade reading that field shows the reason without
the board restating the rule:

```sql
CREATE TRIGGER IF NOT EXISTS the_organiser_puts_up_the_dates
BEFORE INSERT ON option
WHEN NEW.proposedBy IS NOT (SELECT organiser FROM poll WHERE name = NEW.poll)
BEGIN
  SELECT RAISE(ABORT, 'only the person who called the meeting can put up a date');
END;
```

A unique index does the same for the rules it can state, and it holds where a
check in the board cannot: two people acting at once are two statements, and
only one of them can be first.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `mode` | `string` | `"query"` | One of the three above |
| `emit` | `string` | `"result"` | `"result"` passes the answer on, `"input"` passes the request through |
| `database` | `string` | `""` | Which database; services naming the same one share its tables. Empty: derived from the board's title (hkp-node), `default` (browser). Ignored by `databases` |
| `statement` | `string` | `""` | The SQL to run (`query`, `run`, `exec`) |
| `schema` | `string` | `""` | `CREATE TABLE …` applied once per board |
| `lastCount` | `number` | — | Read-only: rows returned, or rows changed |
| `error` | `string` | — | Read-only: why the last pass produced nothing |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | JSON carrying the values the statement names; for `import`, SQL text (or its UTF-8 bytes) |
| **Output** | see the mode table above |

**The answer is returned, not pushed.** SQLite replies inside the call, so
unlike Store there is nothing to wait for and the pipeline simply continues.

Anything that goes wrong — a table that does not exist, a statement that does
not parse — is reported as `{ error }` and **passes nothing on**, stopping the
pipeline rather than letting it act on rows that were never read.

---

## Where it lives

One file per board, under a directory the runtime owns:

```
~/.hkp/node/db/<sha256(owner)>/<sha256(board)>.db
```

`HKP_DB_DIR` moves the root; `HKP_DB_DIR=""` keeps
everything in memory instead, which is what a throwaway run wants.

Files are created `0600` under a `0700` directory, in WAL mode with foreign keys
on. Because a board's data is one file, copying it takes that board's data and
nothing else.

---

## In the browser

The browser's `sql` runs SQLite compiled to WebAssembly
([`@sqlite.org/sqlite-wasm`](https://sqlite.org/wasm)), in the page. A board
whose only reason for a server was its tables can drop the server: move the
`sql` services into a browser runtime and nothing else changes — not the
statements, not the facade. [Court Booking (Browser)](../boards/court-booking-browser-demo-board.md)
is exactly that.

**Person runs use whoever was signed in when the run began** — `$caller_sub`
the account's id, `$caller_email` its address, `$caller_name` its display name
— and `NULL` when nobody is. Nothing verifies that: the browser is the person,
and the tables are theirs alone. What the names buy here is that a board's
statements read the same on both runtimes.

That is for a run that began in the app. On a [deployed board](../concepts/cloud-boards.md#who-began-a-run)
a browser runtime is also handed runs that began elsewhere, and those are
whoever the coordinator says began them — a member, or nobody, in which case
all three are `NULL`. They are never the person whose browser is running the
statement. A `sql` inside a sub-service, a Switch or a track is told the same
as one at the top of the runtime.

**What it gives up is sharing.** The tables are this browser's. Two people on
two devices see two databases, so a board whose point is that several people
see the same rows — a booking sheet for a club, a poll — still wants hkp-node.
A board kept by one person for themselves loses nothing.

### Where it lives

A database lives in memory while the page runs and is kept as a **snapshot in
the browser's IndexedDB** (`hkp-sql`, one entry per database name): written
right after a pass changes it, then read back the next time the name is opened.
Clearing the site's data clears the tables.

Three consequences of keeping snapshots rather than writing a file in place:

- A change reaches storage a few milliseconds after the statement returns, not
  with it. Leaving the page in that window can lose it.
- Every pass that changes something writes the whole database. That is nothing
  for the tables a board keeps for one person; it is the wrong tool for
  megabytes. One write of a database is on its way at a time: a board changing
  it faster than the browser stores it gets fewer snapshots, each holding
  everything up to then.
- Two tabs holding the same database each work on their own copy, and the last
  one to write it wins. Keep one board using a database open at a time.

A snapshot is always a committed state. While a transaction is open — a
`BEGIN` in one pass, its `COMMIT` or `ROLLBACK` in a later one — nothing is
written, and one snapshot follows when it ends. That makes a transaction the
way to say *when*: many changes between `BEGIN` and `COMMIT` cost one write.

A snapshot the browser refuses — storage full, say — is reported as an `error`
by the services whose changes it held. The statement itself succeeded and the
rows are in the page; they are written with the next change that is, or lost
with the page.

Where a page has no IndexedDB at all there is nothing to refuse: the database
lasts as long as the page does, and nothing is reported.

### Which database a `sql` sees

`database` names it, with the same rules as hkp-node — so a board valid in one
runtime is valid in the other. There are no tenants in a browser, so services
naming the same database share it across every board open in that browser.

Left empty, the name is **`default`**, not the board's title: a browser service
does not know the title of the board it is on. Every board that leaves it empty
shares `default`, which is the sharper edge of the two — name the database.

### Loading

The engine is about 900 KB of WebAssembly, loaded the first time a `sql` runs
rather than with the page, so boards without one never download it. That first
pass is the only one that waits; after it, SQLite answers inside the call as it
does on hkp-node.

### Differences in results

- An integer beyond ±2⁵³ comes back as its decimal **string**, since it cannot
  travel as a JSON number without being rounded.
- The panel's **Run** button tries the statement with no parameters and shows
  what it did; it does not call the rest of the pipeline.

---

## Moving a database

`export` and `import` carry a database from one runtime to another as SQL
text — most usefully from a browser, where tables are one person's, to
hkp-node, where a board can keep them for everyone. Both runtimes write and
read the same format, so a database exported by either loads into the other.

### The dump

An ordinary SQLite dump: what `sqlite3 file .dump` writes, and what
`sqlite3 file < dump.sql` reads, so a dump is also a file to keep, read and
diff. The tables with their rows, then indexes, triggers and views, all in one
transaction:

```sql
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS booking (id INTEGER PRIMARY KEY, member TEXT NOT NULL, …);
INSERT INTO "booking"("id","member",…) VALUES(1,'you@club.example',…);
CREATE UNIQUE INDEX IF NOT EXISTS one_per_slot ON booking(court, day, hour);
COMMIT;
```

Values are written by SQLite itself, so each comes back exactly — text with its
quotes and line breaks, blobs as `X'…'`, reals to the last digit — and
`AUTOINCREMENT` counters come along, so an id used by a row since deleted is
not handed out again. Every `CREATE` says `IF NOT EXISTS`, which is what lets a
dump load into a database whose board has already made its (empty) tables from
its `schema`.

A database with a virtual table (full-text search, say) cannot be exported:
its rows live in tables of the module's own, and a dump that recreated both
would load them twice.

`export` reports `{ exported, bytes }` rather than the dump: the text travels
to the next service — [Download](./download.md), in a browser — and a panel has
no use for a second copy.

### Importing

`import` runs the text it is given against the database `database` names,
creating the database if there is none:

- **All or nothing.** A dump is one transaction; if any statement fails — a row
  colliding with one already there, typically — it is rolled back and the
  notice says which. A text that begins no transaction of its own is run
  statement by statement, and what ran before a failure stays.
- **It is refused anything that reaches past its database.** An import is text
  from outside the board, and on hkp-node possibly from a mounted endpoint
  nobody signed in to, so it may not use `ATTACH`, `DETACH`, `VACUUM`,
  `load_extension`, or any `PRAGMA` but `foreign_keys`. Those words inside
  string literals and comments are data and pass. The same rule holds in both
  runtimes, so a dump one accepts the other accepts too.
- **Foreign keys are on again afterwards.** A dump turns them off to load
  tables in any order; every statement after it expects them on.

[SQL Explorer](../boards/sql-explorer-board.md) exports a browser database;
[SQL Import](../boards/sql-import-board.md) loads a dump into hkp-node; and
[SQL Explorer (hkp-node)](../boards/sql-explorer-node-board.md) browses, changes
and exports the databases hkp-node keeps for whoever is signed in.

### Listing

`databases` lists the databases a board could name. In a browser, every one
kept in this browser, and any opened here that already holds something. On
hkp-node, the owner's named databases — not a board's derived one, whose file
is named for a hash of its title and cannot be named back, and not `shared`.

---

## Example

Keeping incoming mail and reading a thread back:

```json
{
  "uuid": "keep-mail",
  "serviceId": "sql",
  "serviceName": "SQL",
  "state": {
    "mode": "run",
    "schema": "CREATE TABLE IF NOT EXISTS mail (messageId TEXT PRIMARY KEY, threadId TEXT NOT NULL, sentAt TEXT NOT NULL, body TEXT); CREATE INDEX IF NOT EXISTS mail_thread ON mail (threadId, sentAt);",
    "statement": "INSERT INTO mail VALUES ($messageId, $threadId, $sentAt, $body) ON CONFLICT (messageId) DO NOTHING"
  }
}
```

```json
{
  "uuid": "read-thread",
  "serviceId": "sql",
  "serviceName": "SQL",
  "state": {
    "mode": "query",
    "statement": "SELECT * FROM mail WHERE threadId = $threadId ORDER BY sentAt ASC"
  }
}
```

For mail specifically, [Conversations](./conversations.md) already owns tables of
this shape, along with the threading rules that decide which `threadId` a
message belongs to.
