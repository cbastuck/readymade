# Meeting Poll (Browser)

[Meeting Poll](./meeting-poll-demo-board.md) with the database moved into the
browser. The same polls, the same rules, the same statements — and nothing to
install.

## What it does

Call a meeting, put up dates, say which ones work, close the poll when a date
is settled. Your polls are still there the next time you open the board.

## How it works

One browser runtime, twelve [SQL](../services/sql.md) services. They are the
other board's services, unchanged: the `sql` service exists in both runtimes
with one contract, and both runtimes are SQLite, so moving the board meant
changing the runtime it sits in and nothing else.

In the browser, SQL runs SQLite compiled to WebAssembly and keeps the database
in this browser's storage. The rules are still the schema's — only the
organiser puts up dates, a closed poll takes nothing more, a person answers a
date once — so the database still refuses what the page would not have
offered, and says why.

## What moving it cost

The team. On hkp-node the tables belong to a server, and every member answers
from their own device as themselves. Here they belong to this browser, so the
only person there is to be is whoever is signed in at this screen.

Who is answering is decided by the same statements as on the server: whoever
is signed in to the app. A browser runs its signed-in person's own runtimes, so
that person is the board's owner here and both organises and answers. Signed
out, the poll is drawn but takes no answer. Nothing verifies the account — the
browser is the person — so what it buys is that the board is the same board on
both runtimes, not that anybody is kept out.

So this is the version for trying the board. To put a date to a team, run
[Meeting Poll](./meeting-poll-demo-board.md) on hkp-node, deploy it and share
it with them.

## Try it

Open it signed in. The schema is created on first run, and the polls are kept
in the browser's IndexedDB under the database name `meetings`.
