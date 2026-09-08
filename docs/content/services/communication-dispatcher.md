# Communication Dispatcher

The manager in the middle of the star. Decides what to do next about an ongoing
exchange, does it, and takes the result back.

---

## Available in

| Runtime | Service ID |
|---|---|
| Node.js (hkp-node) | `communication-dispatcher` |

---

## The shape it makes

Around it sit the **actions** — a nested pipeline each, doing one thing a
business does: understand what was asked, ask for what is missing, quote, send.

```
                    ┌── extract     read the enquiry, record what it says
                    │
poll → iterator → dispatcher ── follow-up   ask for what is missing
                    │
                    └── send        send the approved reply
                          │
                    transition      write down where the exchange got to
```

A board grows by gaining an **action**, not by gaining a runtime. The
alternative — one runtime per step, each polling the state its step handles — is
one board per business rule, and the workflow becomes something you reconstruct
by reading five runtimes and noticing which states they select on.

---

## Why a model decides

What arrives is a person writing an email, and no expression over `state`
anticipates what they will say. The model is given what a new colleague would be
given — the goal, the states the work can be in, the actions available and what
each is for, and the exchange so far — and answers with one action and the state
that follows if it works.

Two things keep that from being a licence to invent.

**The answer is constrained by a schema this service writes.** `action` and
`next` are enums of what this dispatcher actually has, generated from its own
configuration and pushed into whichever nested service takes a `jsonSchema`. An
action that does not exist cannot be named, never mind run — and because the
schema is derived rather than written out by hand beside the actions, it cannot
drift out of step with them.

**An action can declare when it is possible at all.** `available` is an
expression over the input; an action whose precondition fails is not on the menu
this turn. Sending an approved draft is not a judgement call when there is no
approved draft. Narrowing the menu to the legal moves is what makes the choice
good, and it is a different question from which legal move to make.

### Waiting is one of the answers

`wait` is always offered and never configured. Without it, a model asked to
choose an action must choose one, and a conversation waiting on a customer gets
a second follow-up because "none of these" was not among the things it could say.

Waiting still allows the state to change — a manager reading a complete enquiry
decides there is nothing further to obtain and moves it on. When the state named
is the one the exchange is already in, nothing is passed on, so nothing after
this writes a transition for a pass in which nothing happened.

---

## One action per pass

The loop is the poll that fed this service, not a loop in here.

The position of the machine is then a row someone can read rather than a stack
frame; a restart resumes rather than restarts; and a model that changes its mind
costs one call per tick instead of spending a budget in a cycle nobody is
watching. An exchange needing four steps takes four ticks, which for email is
nothing.

The cost guard belongs on the poll, not here: [Conversations](./conversations.md)'
`actionable` takes `idleSeconds`, so an exchange nothing has happened to is not
reconsidered every thirty seconds.

---

## What the model is shown

All of the input. What is worth knowing about an exchange is whatever the board
put in front of this service — the thread, what has already been extracted, what
has already been drafted — and a service that named the parts it understood
would stop being general the first time a board added one. Use
[Join](./join.md) to gather those beside the record rather than replacing it:

```
join (as: thread)  ┐
                   └─ conversations (thread)
join (as: known)   ┐
                   └─ conversations (list-artifacts)
communication-dispatcher
conversations (transition)
```

`maxContextChars` bounds it, so one long attachment cannot cost a context window.

---

## What it hands the action

```json
{ "…the input…", "action": "follow-up", "reason": "…", "params": { "missing": ["numberOfRooms"] } }
```

`params` is the model's, and it is what makes an action reusable: one drafting
action, told what to ask about, rather than one action per question a business
might need to ask. Say in the action's `describe` what parameters it takes —
that description is the only thing the model has to go on.

The prompt for an action belongs **in** the action, not here. A dispatcher that
generated every prompt would be the same baking in a different file.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `goal` | `string` | `""` | What the exchange is for |
| `instruction` | `string` | *(a general one)* | Sent as the opening of the question. Not a system message: the decide pipeline may hold something that already has one, or may not be a model at all |
| `states` | `array` | `[]` | `"name"` or `{ name, describe }`. The enum `next` is drawn from |
| `stateFrom` | `string` | `"state"` | Dotted path to the current state in the input |
| `actions` | `array` | `[]` | `{ name, describe, available, pipeline }` |
| `decide` | `array` | `[]` | The pipeline that asks the model |
| `maxContextChars` | `number` | `20000` | Bound on the input shown to the model. `0` = no bound |
| `lastAction` / `lastReason` / `lastNext` | — | — | Read-only: what it decided, and why |

Edits from the UI arrive branch-scoped — `{ branch: "<action name>" \| "decide", … }` —
so one action's pipeline can be changed without rebuilding another's and
destroying what is running in it.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | the exchange so far, as JSON |
| **Output** | `{ …input, action, params, reason, result, state }` |
| **Nothing** | when there is nothing to do and nothing to change, when the action produced nothing, or when the decision could not be read |

An action producing nothing does not advance the exchange: the state the model
named is the state that follows the action *working*.

---

## Example

```json
{
  "uuid": "manager",
  "serviceId": "communication-dispatcher",
  "state": {
    "goal": "Book a hotel room for the guest who wrote in.",
    "states": [
      { "name": "init", "describe": "nothing has been read out of it yet" },
      { "name": "needs-follow-up", "describe": "something required is missing" },
      { "name": "ready", "describe": "everything required is known" }
    ],
    "decide": [{ "serviceId": "text-generation", "uuid": "decide-llm", "state": { "…": "…" } }],
    "actions": [
      {
        "name": "extract",
        "describe": "Read the thread and record what the guest asked for. Takes no parameters.",
        "pipeline": ["…"]
      },
      {
        "name": "follow-up",
        "describe": "Draft an email asking for details we still need. params: { missing: string[] }",
        "available": "params.known.count > 0",
        "pipeline": ["…"]
      }
    ]
  }
}
```

See `syn-conversations-demo-board.json` for the whole thing running.
