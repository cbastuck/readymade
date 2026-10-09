# Court Booking (Browser)

[Court Booking](./court-booking-demo-board.md) with the database moved into the
browser. The same three courts, the same calendar, the same statements — and
nothing to install.

## What it does

It draws the day as a calendar — one column per court, one row per hour — and
lets you take or give back an hour by tapping a cell. Your bookings are still
there the next time you open the board.

## How it works

One browser runtime, three [SQL](../services/sql.md) services. They are the
other board's services, unchanged: the `sql` service exists in both runtimes
with one contract, and both runtimes are SQLite, so moving the board meant
changing the runtime it sits in and nothing else.

In the browser, SQL runs SQLite compiled to WebAssembly and keeps the database
in this browser's storage. The two club rules are still unique indexes in the
schema, and **The day** still returns cells that already know what they are.

## What moving it cost

The club. On hkp-node the tables belong to a server, and every member sees the
same day from their own device. Here they belong to this browser, so the only
member there is to be is whoever is signed in at this screen.

Who is booking is decided by the same statements as on the server: whoever is
signed in to the app, named on the line above the calendar. Signed out, the
calendar is drawn but offers no hour. In a browser nothing verifies the
account — the browser is the person — so what it buys is that the board is the
same board on both runtimes, not that anybody is kept out.

So this is the version for trying the board, or for booking something that is
yours to share out — a room at home, a shared car. For a real club, run
[Court Booking](./court-booking-demo-board.md) on hkp-node.

## Try it

Open it signed in. The schema is created on first run, and the bookings are kept in the
browser's IndexedDB under the database name `tennis`.
