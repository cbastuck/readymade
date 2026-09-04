# SQL

A board's own SQL database. Tables, columns and meaning all belong to the board.

---

## Available in

| Runtime | Service ID |
|---|---|
| Node.js (hkp-node) | `sql` |

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

---

## The schema

`schema` holds the `CREATE TABLE` statements the board needs. They are applied
**once per board, before the first statement runs** — not on configure, because
a service is configured before the runtime tells it which board it belongs to.

Write it with `IF NOT EXISTS`, since it is applied to a database that may
already have been set up by an earlier run.

Any one `sql` service on the board can carry the schema; the rest see the tables
it created.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `mode` | `string` | `"query"` | One of the three above |
| `statement` | `string` | `""` | The SQL to run |
| `schema` | `string` | `""` | `CREATE TABLE …` applied once per board |
| `lastCount` | `number` | — | Read-only: rows returned, or rows changed |
| `error` | `string` | — | Read-only: why the last pass produced nothing |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | JSON carrying the values the statement names |
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
