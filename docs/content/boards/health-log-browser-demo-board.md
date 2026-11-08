# Private Health Log (Browser)

[Private Health Log](./health-log-demo-board.md) with the database moved into
the browser. The same measurements, the same journal, the same charts — and
nothing to install.

This demo records and displays values. It does not interpret them, recommend
targets, detect emergencies or replace professional care, a meter, a CGM, or an
official device application.

## What it does

The **Log** tab takes blood glucose, blood pressure, weight and a daily
journal; **Trends** draws them as time-series charts; **Your data** shows the
rows themselves and deletes the ones you select, or all of them. **Generate
fake data** there writes six months of fictional history to look at, and
**Export as .sqlite** saves the whole database as a file. Everything you enter
is still there the next time you open the board.

## How it works

One browser runtime holding the other board's services:
[SQL](../services/sql.md) for every write and the read at the end, and a
[sub-service](../services/browser-sub-service.md) whose Monitor shows the event
each new entry produced. The `sql` service exists in both runtimes with one
contract, and both runtimes are SQLite, so moving the board meant changing the
runtime it sits in — and naming the browser's Monitor by its own id — and
nothing else.

In the browser, SQL runs SQLite compiled to WebAssembly and keeps the database
in this browser's storage.

The one thing this board adds is the export, first in the pipeline: a
sub-service holding an SQL service in `export` mode with `format: "sqlite"`
and a [Download](../services/download.md) that saves what it hands on as
`health-log.sqlite`. It stops propagation, and nothing enters the pipeline
above it, so only its own button reaches it — no entry ever passes through.

## What moving it cost

Reach. On hkp-node the history belongs to a runtime you choose — your own
machine, or a server you can open it from on any device. Here it belongs to
this browser on this device: another browser, or this one with its site data
cleared, starts empty.

For trying the board, or for a log you only keep at one screen, that is
enough — and the export is how the history leaves: the file opens in any
SQLite tool (`sqlite3 health-log.sqlite`, DB Browser for SQLite), with the
tables exactly as the board wrote them. To read the same history from your
phone and your laptop, run [Private Health Log](./health-log-demo-board.md) on
hkp-node.

## Try it

Open it. The schema is created on first run, and the history is kept in the
browser's IndexedDB under the database name `private-health-log`.
