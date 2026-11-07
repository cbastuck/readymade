# Shared Costs

Shared costs for a flat. Whoever paid adds what it was for and how much; it is
split evenly between everyone in the flat at that moment, and each person sees
what they owe or are owed. No board like it shipped with Readymade:
[Board Assist](../concepts/board-assistant.md) composed this one from a single
description.

## What it does

Open the board and you join the flat. On **Balances**, type what you paid for
and how much, *Groceries 42.50*, and press **Add**. The total at the top says
what you owe or are owed across everything, and the list below says it for
everyone in the flat. **Expenses** lists what was paid for, newest
first, with your share of each. Only whoever paid can remove an expense.

## How it works

One [REST runtime](../concepts/runtime.md#the-servers) on hkp-node, kept under
the name `node`. Six [SQL](../services/sql.md) services share one database,
`flat-costs`: three that change something and three that read it back.

**Actions** — Join the flat · Add an expense · Remove an expense

**Queries** — My balance · Everyone's balance · The expenses

Every action enters the same pipeline at **Join the flat**, which runs when
the board opens, and the queries at the end re-read what it just changed. What
you see after adding an expense is what the database now says.

## The rules live in the schema

- **An expense needs a payer who is in the flat, says what it was for, and has
  an amount above zero.** Four triggers, each refusing with a sentence that
  tells you what to do instead.
- **The even split is a trigger too.** When an expense is added, one share per
  flatmate is written beside it. Money is kept in cents, and a leftover cent
  or two goes to whoever joined first, so the shares always add up to what was
  paid.
- **A share goes with its expense.** Removing an expense removes its shares.

Because the split is written when the expense is added, somebody who joins the
flat later does not owe for what was bought before they came.

## Who paid

Every expense is recorded for the signed-in caller. The statements use
`$caller_email` and `$caller_name`, which the server that verified the sign-in
states, and the facade has no "paid by" field. Without a signed-in caller the
board shows the balances but takes no expense. Others in the flat are shown a
flatmate's name, never their address. See
[callers and members](../concepts/cloud-boards.md).

Deployed and shared, the flat is the board's members: each signs in to the
board's app and nothing else, and they all use one database.

## How it was made

The board is the one Board Assist proposed in a recorded run (Claude
Opus 5.5) from this description: whoever paid adds it, it is split evenly,
everyone sees what they owe, each expense in the name of whoever is signed in,
on the node server so the flat can share it. That conversation took five
requests and 201,393 tokens, about $0.99. The proposal's review listed 138 new
lines, all six statements. The form, the lists, the sign-in and the sharing
are services other boards already use.
