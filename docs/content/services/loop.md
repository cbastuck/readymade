# Loop

Runs a nested pipeline again and again on its own output. Repetition you can
see in the board.

> Two neighbours with similar names: [Iterator](./iterator.md) runs one
> pipeline over **many items**, once each. The browser's
> [Looper](./looper.md) records a stream of values and replays them.

---

## Available in

| Runtime | Service ID |
|---|---|
| Python (hkp-python) | `loop` |
| C++ (hkp-rt) | `loop` |

The same board reads the same in each. Where they differ is in how a run
answers its call — see [Run and step](#run-and-step).

---

## What it does

A pipeline pass runs each service once. Some work is not shaped like that:
generating text appends one token and then does everything again with the
longer text; a refinement improves an answer until it is good enough.

Loop holds a pipeline and feeds it its own output. What a round returns is what
the next round is given:

```
injector { n: 1 } → loop ┐                → monitor { n: 1024 }
                         └─ map (n * 2)      until: params.n >= 1000
```

The Map runs ten times. The Monitor after the Loop is called once.

Nothing in it knows what the value is. It was built for the loop inside a
language model, where each round appends a token, and it is just as much a
counter.

---

## When it ends

| Reason | What happened |
|---|---|
| `until` | The condition held on a round's output |
| `maxRounds` | The limit of rounds was reached |
| `ended` | The nested pipeline stopped — a round passed nothing on, so there is nothing to give the next |
| `stopped` | Somebody sent `{ "stop": true }` |
| `failed` | A round threw (C++, in a run) |

`until` is an expression over a round's output, bound to `params` — the
dialect [Map](./map.md) and [Filter](./filter.md) use: `params.done`,
`params.n >= 1000`, `params.tokens.length > 40`. It is asked after every
round. Left empty, the limit is what ends the loop.

`maxRounds` is there so that a condition that never holds does not run for
ever. `0` removes it, and then only the condition, a stopped pipeline or Stop
ends the loop.

The first three leave the loop **done**: it has nothing more to do until it is
given a new value. `stopped` and `failed` do not — the loop keeps the value it
had and can be carried on.

---

## A value starts it, nothing carries it on

A call **with a value** starts over: round one, with that value.

A call **with nothing** continues from the value the loop holds. That is how a
Step button works — a facade `button` with a `process` action on the Loop,
passing nothing — and how a stopped loop is resumed.

With nothing held, or once done, a call with nothing passes nothing on.

`{ "reset": true }` drops what is held.

---

## Run and step

| `mode` | One call runs |
|---|---|
| `run` | rounds until the loop ends |
| `step` | exactly one round |

Switch between them at any time: a loop walked for three rounds in `step` runs
to its end in `run` with the next call.

**Every round is reported**, in both modes, as

```json
{ "round": 3, "done": false, "reason": "", "output": { "n": 8 } }
```

so a facade `text` widget reading `output.text`, or a `data-table`, shows what
the loop is building while it runs.

**Stop** is `{ "stop": true }`, sent as a configure. The round in progress
finishes, the loop keeps its value, and the next call with nothing carries on
from there.

### How a run answers

- **Python** runs the rounds inside the call, on the thread pipelines run on,
  and answers with the last round's output. Configures are taken on another
  thread, which is how Stop gets through.
- **C++** does not hold its pipeline thread, which in the Readymade app is
  also the UI's. A `run` answers its call at once with nothing, takes each
  round as an event of its own, and hands the last round's output to the
  services after it when it ends — as [Text Generation](./text-generation.md)
  does with its answer. A `step` is one round and answers with it.

Either way the service after the Loop is called **once per call**, with the
last round's output.

In C++ the services inside a Loop answer their call themselves. One that
answers later — Text Generation, an HTTP request — ends the round with
nothing, and so the loop.

---

## A round that fails

The call ends, and the loop keeps the value it had **before** that round, so
it can be carried on once whatever failed is put right. In Python, and for a
C++ step, the failure is the call's failure. A C++ run has already answered,
so it logs `service.failed`, reports the round with an `error`, and hands
nothing on.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `pipeline` | `array` | `[]` | The nested services, in order |
| `until` | `string` | `""` | Expression over a round's output (`params`); the loop ends when it holds |
| `maxRounds` | `number` | `100` | End after this many rounds. `0` = no limit |
| `mode` | `"run"` \| `"step"` | `"run"` | Rounds until done, or one round per call |
| `bypass` | `boolean` | `false` | Pass the input through untouched |
| `stop` | `true` | — | Command: end the run after the round in progress |
| `reset` | `true` | — | Command: drop the held value |
| `round` | `number` | — | Read-only: rounds run since the loop was started |
| `running` | `boolean` | — | Read-only: whether a run is under way |
| `done` | `boolean` | — | Read-only: whether the loop has ended |
| `reason` | `string` | — | Read-only: why it is not running |

A condition that does not parse is refused when it is configured, not when
the loop first reaches it.

A Loop with an empty pipeline, or one that is bypassed, passes its input
straight through, as an empty SubService does.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | any value, to start from — or nothing, to carry on |
| **Output** | the last round's output, or **nothing** when no round ran |

A value that is not JSON — audio, bytes, a model's tensor — goes round
untouched. A condition is asked only of JSON; such a loop ends by its limit or
by its pipeline stopping.

---

## Runs and logs

Each round runs as a **run of its own** in Python, descended from the run that
reached the Loop, so a log answers *what did round seven do*. Nested services
log to the board's log like any other and report their notifications out
through the Loop.

---

## Example

Generating until the model ends, at most 200 tokens, one token per round:

```json
{
  "uuid": "generate",
  "serviceId": "loop",
  "serviceName": "Loop",
  "state": {
    "until": "params.end",
    "maxRounds": 200,
    "pipeline": [
      { "serviceId": "llm-decode", "uuid": "forward" },
      { "serviceId": "sample", "uuid": "pick", "state": { "mode": "greedy" } },
      { "serviceId": "detokenize", "uuid": "piece" }
    ]
  }
}
```

The demo board counts instead: it doubles a number until it passes a thousand.
