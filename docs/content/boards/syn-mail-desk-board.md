# SYN Mail Desk

`syn-mail-desk-board.json` is the existing SYN composition with a human review
facade in front of it. The booking and hotels units are included unchanged;
their original facades are hidden in this composition, and remain available in
the original `syn-board.json`.

## The three lanes

- **Incoming mail** shows active enquiries received and filed by the booking
  unit.
- **Needs human review** shows the latest pending follow-up draft. Its card
  editor calls the generic fields **Subject** and **Body** and writes only to a
  still-pending draft.
- **Waiting for user response** shows conversations whose approved email was
  sent successfully.

Only review cards can be moved, and only the waiting lane accepts them — by
dragging the card there, or from the card's **Move** menu. Either way the
move asks for confirmation and marks the draft approved through the
Conversations service. It does not move facade state. The unchanged booking
dispatcher observes the approval, sends through SMTP, files the outbound mail,
marks the artifact sent and transitions the conversation. The database query
then places the card in the waiting lane. If sending fails, the conversation
does not transition and the card remains in review.

## Composition

The small `syn-mail-desk-unit-board.json` unit is an adapter, not a second mail
engine. It uses the explicitly named `syn-booking` database owned by the
booking workflow and projects conversations, inbound messages and follow-up
artifacts into the five fields a swimlane consumes. Its **Approved draft
event** Monitor exposes the approval artifact after every approved drop; more
services, including a call to another board, can be composed after that
Monitor later.

Run hkp-node, keep it under the name `node` in *Manage runtime servers*, and
load these four sibling board documents
together when opening the composition:

- `syn-mail-desk-board.json`
- `syn-booking-unit-board.json`
- `syn-hotels-unit-board.json`
- `syn-mail-desk-unit-board.json`

The same mail and model secrets required by the original SYN board are still
required. SMTP recipient restrictions also remain exactly as configured in the
booking unit.
