# Meeting Poll

Dates for a meeting, answered by everybody it is put to. The board's owner
calls a meeting and puts up times; everybody else says which ones work for
them — none, one, or all.

## What it does

A Doodle-shaped poll. Call a meeting, propose dates, collect answers, close the
poll when a date is settled.

## How it works

One [REST runtime](../concepts/runtime.md#the-servers) on hkp-node. Twelve
[SQL](../services/sql.md) services: seven that change something and five that
read it back.

**Actions** — Who is here · Call a meeting · Put up a date · Withdraw a date ·
Works for me · Take an answer back · Close or reopen

**Queries** — The dates · The meeting · What the owner runs · Dates to
withdraw · Every meeting

Every tap in the facade enters the same pipeline, and the queries at its end
re-read what it just changed. There is no separate refresh path and no cached
copy of the poll in the board, so what you see after an action is what the
database now says — including any change somebody else made in the meantime.

Which meeting is shown is the one a person last picked, and until they pick
one, the meeting called last — so somebody opening the board for the first time
lands on the poll they were sent it for. Answering a date keeps them on its
meeting, even after a newer one is called. Switching to another is done on
**Vote** itself, from **Meetings** above the dates — a member has nothing else
to open **Organise** for.

## The rules live in the schema

None of them is board logic:

- **That only the owner calls a meeting** — a trigger.
- **That a date belongs to a meeting, put up by whoever called it** — two triggers.
- **Whether a closed poll still takes a date or an answer** — two triggers.
- **That a person answers a date once** — a unique index.

The board therefore never offers something the database would refuse, and when a
refusal does happen — two people acting at once, a stale page, a client sending
what the facade would not — the error says *why*, because the constraint that
fired names itself.

Keeping these in the schema rather than the pipeline is the same argument as in
[Court Booking](./court-booking-demo-board.md): a check followed by a write has
a gap between them, and a constraint does not.

## Who is answering, and who organises

Every answer is given in somebody's name, and the board never takes that name
from the request. The statements use the verified caller directly —
`$caller_email`, the address the server that verified their sign-in states —
and there is no "you are" field in the facade or its payloads. Without a
signed-in caller with a verified address the board shows the poll but takes no
answers.

What somebody may *do* is read the same way. `$caller_role` is what the person
is to the board — `owner` or `member` — stated by whoever admitted them
([SQL: who is calling](../services/sql.md#who-is-calling)). Calling a meeting
records the caller as its organiser only when that role is `owner`; anybody
else's call names nobody, and the schema refuses it with *only the board's
owner can call a meeting*. Putting up dates, withdrawing them and closing the
poll are then the organiser's, which is the owner.

Others are never shown an address. Each person's name is the one the board's
member list gives them, recorded by **Who is here** as they come by; a voter
the list names nothing is *a member*, and the owner, whom their own list need
not name, is *the organiser*.

## The facade

Two tabs. **Vote** — *Which dates work?* — is what most people ever see: who is
answering (`{ "$user": "name" }`), the meetings to switch between, the one
picked and whose it is, and one row per date. **Organise** — *The
meeting* — is the owner's: the meetings to pick from, then for the one picked,
putting up a date, closing the poll and withdrawing dates, and calling a new
meeting. `defaultTab` is Vote, because answering is the
common case and setting up happens once.

A facade cannot hide a widget from one person and not another, so the
Organise controls are drawn from rows only the owner is sent. **What the owner
runs** and **Dates to withdraw** end in `WHERE $caller_role = 'owner'`; for a
member they answer with nothing, and the controls are not there. That is how
it looks, not what keeps it safe — the entry point takes any payload, and it is
the statements behind it that refuse.

## Sharing it with a team

1. Deploy the board to a coordinator.
2. Open it in Cloud Boards and choose **Members**: one entry per person, the
   address they sign in with and the name the others should see. Add yourself
   too if you want to be called something other than *the organiser*.
3. Open it from Cloud Boards — it opens on its facade — and call a meeting and
   put up its dates on **Organise**.
4. Send everybody the link from *Copy link*. It opens only for somebody on the
   list.

Each member sees the poll from their own side — their answers marked as theirs,
everybody else's by name. One thing to know: a member's view is redrawn by their
own actions, so somebody else's answer shows on their next tap rather than at
once.

## Try it

Needs a signed-in account and an hkp-node kept under the name `node` in
*Manage runtime servers*. Opened in the playground you are the board's owner:
call a meeting on **Organise** to start. The schema is created on first run, in
a database of its own (`meetings`) — the board's earlier `meeting-poll`
database is left as it was, and its polls are not carried over. They named
people by whatever was typed rather than by a verified address, so not one of
them would match a caller; and since the schema only creates what is missing,
opened on the old database it would have kept the old tables and rules beside
the new ones.
