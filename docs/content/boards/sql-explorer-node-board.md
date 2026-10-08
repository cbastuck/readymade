# SQL Explorer (hkp-node)

Every SQL database your hkp-node keeps for you, and what is in it — the
[SQL Explorer](./sql-explorer-board.md) pointed at a server instead of at this
browser.

## What it does

The first column lists the databases hkp-node's [SQL](../services/sql.md)
service keeps under your sign-in, with their size. Pick one to see its tables
and views; pick a table to see its rows. Click a value to change it; tick rows
and **Delete picked rows** to remove them. **Export .sql** saves a database as
an ordinary SQL dump.

## Whose databases

Yours, and that is exact rather than a manner of speaking. hkp-node is used by
several people at once, and it files every database under the **owner of the
runtime asking** — the person the server verified, never a name a board
supplies. So this board has no setting for whose databases to show: opened by
you it lists yours, and opened by somebody else on the same server it lists
theirs. Naming a database that belongs to another person does not reach it —
the name is looked up inside your own tenant, and finds your own database of
that name or an empty one.

Three things follow from that, and are worth knowing before you rely on it:

- **A deployed board's data is here too.** A board you deployed to a
  coordinator runs in your tenant, so the tables of your deployed
  [Court Booking](./court-booking-demo-board.md) show up as `tennis` — the
  bookings its members made included. That is what makes this the tool for
  looking into a shared board.
- **It is the live database.** A change made here is what the board reads
  next. Export first if you may want the old state back.
- **Only named databases are listed.** A board that leaves `database` empty
  has its tables filed under a name derived from its title, which nobody can
  write back as a name — so it cannot be opened from here. Give a board a
  `database` if you want to look into it.

On a server running without sign-in — a local one — everybody is the same
anonymous owner, and the list is everything that server keeps.

This is an owner's tool. It is not something to [share](../concepts/cloud-boards.md#sharing-a-board-members):
it changes whatever statements its facade is pointed at, which is exactly what
a member of a board is not allowed to do.

## How it works

The statements are the browser explorer's, unchanged — both runtimes are
SQLite — so what differs is only where they run:

1. **hkp-node** — three sub-services that each keep their result to
   themselves: which databases (`sql` in `databases` mode), which tables (a
   query over the schema that also writes the statements for each table), and
   which rows, with the two statements that change them.
2. **Browser** — an [Injector](../services/injector.md) the export button
   starts.
3. **hkp-node** again — `sql` in `export` mode.
4. **Browser** — [Download](../services/download.md) saves what arrives.

The export is four steps rather than one because of where a result goes. Asking
a service on hkp-node to do its job answers whoever asked and travels no
further, which is right for a list the facade draws — but a dump has to end up
in the browser's Download. So the export is begun in a browser runtime: its
output becomes the input of the runtime after it, hkp-node answers with the
dump, and that becomes the input of the last runtime, which saves it.

## Try it

Needs hkp-node on port 8080. If the list is empty, no board of yours has stored
anything there under a name yet —
[Court Booking](./court-booking-demo-board.md) does, as `tennis`.

To carry a database the other way, from a browser to hkp-node, use
[SQL Import](./sql-import-board.md).
