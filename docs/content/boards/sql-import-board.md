# SQL Import

Carries a database on to hkp-node: pick an SQL dump, name the database it goes
into, and send it.

## What it does

The dump is typically one the [SQL Explorer](./sql-explorer-board.md) exported
from a browser, but any SQLite dump will do. Once imported, the database is
your hkp-node's, and any board there naming it carries on with its tables —
import a browser's `tennis` and [Court Booking](./court-booking-demo-board.md)
on hkp-node shows the bookings made in the browser.

The list on the right is what hkp-node keeps under names a board can use.

## How it works

Two runtimes, chained:

1. **Browser** — [File Source](../services/file-source.md) reads the file the
   facade's file picker hands it, and passes the text on.
2. **hkp-node** — [SQL](../services/sql.md) in `import` mode runs it against
   the named database, then SQL in `databases` mode lists what is there.

An import is all or nothing: a dump is one transaction, so a row that collides
with one already in the database — importing the same dump twice, say — keeps
none of it, and the notice names the row. The database is created when it does
not exist; one that already has the dump's tables, empty or not, takes the rows
too.

An import runs text that came from outside, so it may not reach past its own
database — no `ATTACH`, `VACUUM`, `load_extension`, or `PRAGMA` beyond
`foreign_keys`. A dump never needs them.

## Try it

Needs an hkp-node kept under the name `node` in *Manage runtime servers*.
