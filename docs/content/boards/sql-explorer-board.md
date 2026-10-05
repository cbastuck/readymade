# SQL Explorer

Every SQL database this browser keeps, and what is in it — to look at, to
change, and to take somewhere else.

## What it does

The first column lists the databases the [SQL](../services/sql.md) service
keeps in this browser, with their size. Pick one to see its tables and views;
pick a table to see its rows. Click a value to change it in a small dialog;
tick rows and **Delete picked rows** to remove them. **Export .sql** saves a
database as an ordinary SQL dump.

Changes go straight into the database, so the board that owns it sees them the
next time it reads: renaming a member here renames them on the court booking
too. Export first if you may want the old state back.

The databases are the ones other boards made: book a court on
[Court Booking (Browser)](./court-booking-browser-demo-board.md) and `tennis`
appears here, with its `booking` table.

## How it works

One browser runtime holding four small pipelines, one for each thing the
facade asks. Each is a sub-service that keeps its result to itself, so picking
a table does not also re-list the databases:

1. **Which databases** — `sql` in `databases` mode.
2. **Which tables** — a query over `sqlite_schema`.
3. **Which rows** — the table's rows, and the two statements that change them:
   one setting a value, one deleting picked rows.
4. **The dump** — `sql` in `export` mode, then [Download](../services/download.md).

Picking a database configures the other three with its name. Picking a table
configures the row statements for that table. A table or column name, unlike a
value, cannot be a bound parameter, so the tables query writes those three
statements for each table itself — every name quoted as an identifier, every
value still a parameter:

```sql
UPDATE "booking" SET "member" = CASE WHEN $column = 'member' THEN $value ELSE "member" END, …
 WHERE $action = 'update' AND rowid = $rowid
```

Rows are addressed by their `rowid`, the first column shown. A view, or a table
declared `WITHOUT ROWID`, has none to address, so those are shown but not
changed. Neither is a table with a column of its own called `rowid`: there the
name means that column, whose values need not be unique, so a statement written
for one row could reach several.

Editing a cell is the data table's `cellActions`: a **prompt** step asks for the
new value, starting from the current one, and hands the answer to the update.
A value typed into a numeric column is stored as a number, as SQLite does
with any text that looks like one; there is no way to set a value to `NULL`
from the dialog.

## Taking the tables to hkp-node

The exported file is what hkp-node's SQL service imports — load it with
[SQL Import](./sql-import-board.md), and a board on hkp-node that names the
same database carries on with the same tables.

To look into the databases a server keeps instead, use
[SQL Explorer (hkp-node)](./sql-explorer-node-board.md): the same board with
the runtime changed.

## Try it

Open it. Nothing to install; if the list is empty, a board using the browser's
SQL has not stored anything yet.
