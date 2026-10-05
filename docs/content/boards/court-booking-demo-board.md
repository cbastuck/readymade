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

## Who is booking

Every hour is booked in somebody's name, and the board never takes that name
from the request. Each statement works out who is acting the same way:

```sql
CASE WHEN $caller_sub IS NULL THEN $member ELSE $caller_email END
```

`$caller_email` is the address of whoever began the run, **stated by the server
that verified their sign-in** — see
[SQL: who is calling](../services/sql.md#who-is-calling). The typed `$member`
counts only when nobody is signed in at all, which is how the board still runs
against a local server with no accounts. Somebody signed in without a verified
address is nobody's member and books nothing; they are not whoever the payload
says.

This is what makes the board safe to **share**. Deployed to a coordinator and
[shared with a club](../concepts/cloud-boards.md#sharing-a-board-members),
every tap of every member enters the same pipeline in the owner's database,
and a member's client is free to send any payload it likes. It can claim to be
someone else; the statements do not ask it. What it sends is also held to the
club's week, courts and whole hours by the insert itself, since the facade's
buttons are not the only thing that can call it.

Other members are never shown an address. A taken hour is labelled with the
name the club's member list gave its holder when they booked, and *Member*
where it gave none.

## The facade

Two tabs: **Court**, with the calendar, and **Who you are**, which says who you
are booking as (`{ "$user": "name" }`) and keeps a field for running without
sign-in. Two tabs because they belong to different moments — who you are is
settled once and you book every week.

## Sharing it with a club

1. Deploy the board to a coordinator.
2. Open it in Cloud Boards and choose **Members**: one entry per person, the
   address they sign in with and the name the others should see.
3. Send them the link from *Copy link*. It opens only for somebody on the list.

Each member sees the calendar from their own side and nothing else of the
board. One thing to know: a member's calendar is redrawn by their own actions,
so somebody else's booking shows on their next tap rather than at once.

## Try it

Needs hkp-node on port 8080. The schema is created on first run, in a table of
its own (`court_booking`) — the board's earlier `booking` table is left as it
was.
