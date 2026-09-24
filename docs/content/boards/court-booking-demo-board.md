# Court Booking

Three courts, an hourly calendar from 07:00 to 22:00, one hour per member per
day. A small booking system where both club rules are enforced by the database
rather than by the board.

## What it does

It draws the day as a calendar — one column per court, one row per hour — and
lets a member take or give back an hour by tapping a cell.

## How it works

One [REST runtime](../concepts/runtime.md#the-servers) on hkp-node, three
services, all [SQL](../services/sql.md):

1. **Give an hour back** — releases a booking.
2. **Take an hour** — makes one.
3. **The day** — returns the whole day as cells that already know what they are:
   free, yours, or somebody else's.

The [calendar widget](../concepts/board.md#the-facade) draws whatever that last
query returns. It contains no rules of its own.

## The rules are indexes, not logic

Two club rules — *a slot is bookable once*, and *a member gets one hour a day* —
are **unique indexes** in the schema. Not checks in the board, not conditions in
a template.

That distinction earns its keep the moment two members tap the same slot at the
same instant. A board that checked availability and then booked would have a gap
between the two, and both taps would succeed. A unique index has no gap: the
second insert fails, and the failure is the answer.

It also means the rules cannot be bypassed by another board, a direct query, or
a future version of this one that forgets them.

## One query draws the screen

**The day** returns cells already carrying their own state, so the widget
performs no interpretation — it draws what it was given. Every tap enters the
same pipeline and the query at the end re-reads what changed, which is why the
calendar is correct after somebody else's booking without anything having to
push an update.

## The facade

Two tabs: **Court**, with the calendar, and **Who you are**, holding the
identity used for *one hour per member*. Two tabs because they belong to
different moments — you say who you are once and book every week.

## Try it

Needs hkp-node on port 8080. The schema is created on first run.
