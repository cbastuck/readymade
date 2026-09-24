# Meeting Poll

Dates for a meeting, answered by whoever is coming. The organiser puts up times;
everybody else says which ones work for them — none, one, or all.

## What it does

A Doodle-shaped poll. Propose dates, collect answers, close the poll when a date
is settled.

## How it works

One [REST runtime](../concepts/runtime.md#the-servers) on hkp-node. Ten
[SQL](../services/sql.md) services: six that change something and four that read
it back.

**Actions** — Call a meeting · The example dates · Put up a date · Withdraw a
date · Works for me · Take an answer back · Close or reopen

**Queries** — The dates · The meeting · Every meeting

Every tap in the facade enters the same pipeline, and the queries at its end
re-read what it just changed. There is no separate refresh path and no cached
copy of the poll in the board, so what you see after an action is what the
database now says — including any change somebody else made in the meantime.

## The rules live in the schema

Three of them, and none is board logic:

- **Who may put a date up** — a trigger.
- **Whether a closed poll still takes a date** — a trigger.
- **That a person answers a date once** — a unique index.

The board therefore never offers something the database would refuse, and when a
refusal does happen — two people acting at once, a stale page — the error says
*why*, because the constraint that fired names itself.

Keeping these in the schema rather than the pipeline is the same argument as in
[Court Booking](./court-booking-demo-board.md): a check followed by a write has
a gap between them, and a constraint does not.

## The facade

Two tabs. **Vote** — *Which dates work?* — is what most people ever see.
**Organise** — *The meeting* — is the half the organiser needs. `defaultTab` is
Vote, because answering is the common case and setting up happens once.

## Try it

Needs hkp-node on port 8080. Press **The example dates** to seed a poll.
