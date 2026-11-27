# Group Chat

One conversation for everybody a board is shared with. Deploy it, put people on
its member list, and each of them writes as themselves.

## What it does

A single room, drawn as a chat: your messages on the right, everybody else's on
the left under their names, each with the time it was sent. Send a message and
everybody attached sees it at once. The board's owner can clear the history.
Nobody else is shown that control.

## How it works

One [REST runtime](../concepts/runtime.md#the-servers) on hkp-node, holding the
thread in the board's own [SQL](../services/sql.md) database. Sending enters
the pipeline at **Post**. **Clear history** does nothing unless the request
asks for it, and **Thread** reads the latest 200 messages back, oldest first.

On a [deployed board](../concepts/cloud-boards.md), what a person's run
produces normally goes to that person's browsers only, because what one member
did isn't another member's to read. The facade makes one exception: it names
**Thread** in `broadcast`, which says the thread is everybody's. So the answer
to one member's message is sent to everybody attached, and each member is sent
only what the facade reads of it, the rows. Nothing re-reads on a timer.
Somebody who has just opened the board reads the thread once, in the facade's
`init`.

The thread is a [message list](../concepts/board.md#the-facade) fed the
whole thread at once. Each time the rows arrive they replace what's shown. A
message you send is drawn straight away as *sending…* and becomes an ordinary
message when the thread comes back holding it.

## Who wrote it

A message is signed with the caller the server verified: `$caller_name`, the
name the owner gave that person on the member list, and `$caller_email`, their
address. Neither comes from the request, so a client sending its own `author`
field changes nothing. The name is stored with the message, so renaming
somebody later leaves what they already said as it was. The address stays in
the table: the thread sends names, never addresses.

The owner writes under the name the list gives them if they've added
themselves to it, and as *Owner* until then.

Your own messages are told apart by name: the list compares each message's
author with who is looking (`mineWhen`). That decides how a message is drawn,
and nothing else. Give two members the same name and each sees the other's
messages on their own side.

Two rules live in the schema rather than the pipeline. A message must have an
author, and it must fit in 2000 characters. Breaking either is refused with the
reason, and the facade shows the reason as a notice. Clearing the history checks
`$caller_role = 'owner'` in the statement itself. Hiding the button from members
decides what they're shown. The check decides what they can do.

## Before running it

It needs an hkp-node kept under the name `node`, signed in. A server running
without authentication has no caller, so every message is refused with *sign in
to write*.

Opened in the playground, the board is yours alone. To chat with other people,
deploy it and add them as [members](../concepts/cloud-boards.md#sharing-a-board-members).

Times are the server's, in UTC.
