# Introduction

HKP is a framework for building **interactive apps** out of small, composable
parts — apps that run across several machines at once, where you decide which
part runs where.

You build by assembling **services** into **runtimes**, and runtimes into a
**board**. The board is the app. It is also a single JSON document, which means
an app you have built is a thing you can save, read, hand to someone else, and
edit by hand.

---

## What people build with it

- A voice assistant whose speech recognition runs on your own machine and never
  uploads the audio.
- An audio analyser: live capture and FFT running natively, the display running
  in the interface next to it.
- A chat bot on a server that keeps answering when every browser is closed.
- A control surface for hardware in another room, driven from your phone.
- A one-afternoon experiment that reads a feed, transforms it, and draws
  something — thrown away on Friday.

The same three building blocks cover all of them. The difference between the
throwaway and the thing that runs for a year is mostly *where* you put the
pieces.

---

## The shape of it

- A **board** is the app: a named list of runtimes, in order.
- A **runtime** is an execution environment on some machine: a list of services,
  in order.
- A **service** is one step: it takes data in and produces data out.

Order is the wiring. The output of each service is the input of the next, and
when a runtime finishes, its result becomes the input of the next runtime on the
board — including when that runtime is on another machine, which is handled for
you and looks like nothing at all from inside the board.

Every board has exactly one owner, the **coordinator**. Usually that is the app
you are using; a board can also be handed to an external coordinator that keeps
it running with nobody watching.

**[Architecture](./architecture.md) explains all of this properly**, including
why it is built this way and what does and does not cross between machines. It
is the page to read next.

---

## A board is a document

Anything you build can be exported as JSON and restored from it. The board menu's
**Edit Board Source** takes a board document and rebuilds the board from it, so
sharing an app is sharing a file — and so is editing one by hand when that is
faster than clicking.

A small complete board looks like this:

```json
{
  "boardName": "My Board",
  "runtimes": [
    { "id": "rt-1", "name": "Browser", "type": "browser", "state": {} }
  ],
  "services": {
    "rt-1": [
      {
        "uuid": "svc-1",
        "serviceId": "hookup.to/service/timer",
        "serviceName": "Timer",
        "state": {
          "periodicValue": 1,
          "periodicUnit": "s",
          "periodic": true,
          "running": true
        }
      }
    ]
  }
}
```

Every service carries a `serviceId` saying what it is, a `uuid` that stays
stable across saves, and a `state` object holding its configuration. Restoring a
board replays that state, which is why re-opening one gives you the app back
exactly as you left it.

The repository file `docs/content/llm/circle-text-board.json` is a complete
runnable example; the [circle-text walkthrough](./llm/howto-workflow.md) shows
how it was built.

---

## What flows between services

The value passed from one service to the next is not restricted to JSON. The
types that travel are:

| Type              | What it carries                                                      |
| ----------------- | -------------------------------------------------------------------- |
| **JSON**          | Structured data — the most common case by far                        |
| **Text**          | A plain string                                                       |
| **Binary**        | Raw bytes — a file, an image, an encoded frame                       |
| **FloatRingBuffer** | A contiguous block of float samples; audio is the usual reason for it |
| **Mixed**         | Bytes and JSON metadata together, e.g. a file plus what it is        |
| **Null**          | "Nothing to pass on" — stops the flow here                           |

These are the same everywhere. A buffer of samples produced by a service on one
machine arrives as a buffer of samples on the next, without you converting
anything or knowing how it was packed for the journey.

`FloatRingBuffer` carries samples and nothing else — what those samples *mean*,
including their sample rate, is configuration you set on the services that
produce and consume them.

---

## Reaching things outside the board

Chaining between runtimes on the same board is automatic and needs no services.
Services like **Input**, **Output**, **HTTP Client**, and **HTTP Server** are for
something different: talking to the world *outside* the board.

Use them to call an API, to receive a webhook, to expose an endpoint other
software can hit, to stream from a socket someone else is serving — or to
connect two separate boards. Inside one board, you do not need them to get data
from one runtime to the next.

---

## Readymade

**Readymade** is the native app — macOS, Windows, Linux, iOS, and Android — that
runs boards outside the browser. It bundles the hkp-rt runtime, so a board opened
in it can use the machine's real audio hardware, its filesystem, and its sensors
while every byte stays on the device.

A board authored in Readymade is the same document as one authored in the
playground. It moves between them, subject to the runtimes it names being
reachable from wherever it is opened.

---

## How to read these docs

| Page                                   | What it covers                                                     |
| -------------------------------------- | ------------------------------------------------------------------ |
| **[Architecture](./architecture.md)**  | Boards, runtimes, services, coordinators — and the reasoning        |
| **[Runtimes](./runtimes.md)**          | The four runtimes, what each is for, and how to choose              |
| **Service reference**                  | Every service in depth — modes, settings, inputs and outputs        |
| **[Guides](./llm/howto-workflow.md)**  | Worked examples built step by step                                  |

The service reference is the sidebar's **services** section; each page documents
one service's modes, every configuration property, the shape of its input and
output, and worked examples. Which services a given runtime offers is covered in
[Runtimes](./runtimes.md).
