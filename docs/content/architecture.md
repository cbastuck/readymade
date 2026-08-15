# Architecture

HKP is a framework for building **interactive apps** — things people open,
configure, and use in real time. Not automation pipelines that run overnight,
but apps: a voice assistant, an audio analyser, a chat client, a control surface
for a machine in the next room.

There are three building blocks, and everything else in this documentation is a
detail of one of them:

| Block       | What it is                                       | What you do with it                          |
| ----------- | ------------------------------------------------ | -------------------------------------------- |
| **Board**   | The app. One document, one owner.                | Build it, run it, hand it over, share it.    |
| **Runtime** | An execution environment that hosts services.    | Decide *where* a piece of your app runs.     |
| **Service** | The unit of work: takes input, produces output.  | Decide *what* your app does, step by step.   |

A board contains runtimes. A runtime contains services. That is the whole shape.

---

## The board

A board is the app itself, and it is also a single document. That document names
the board, lists its runtimes in order, and lists the services inside each
runtime in order. Nothing about a board lives outside of it — hand someone the
document and you have handed them the app.

### Every board has exactly one owner

The owner is called the **coordinator**. It holds the board's live state: which
runtimes exist, which services are in them, and what each of those last
reported. It is the only thing on the board with a view of the *whole* board,
which is why it answers the questions no single runtime can — where a service
endpoint actually lives, what addresses to bake into a board you are exporting.

There are two kinds of coordinator, and the difference is the single most
important thing to understand about how a board runs.

**An internal coordinator** is the app you are already using. The playground in
your browser, or Readymade on your desktop, phone, or tablet. It owns the board,
hosts the runtimes that live inside it, and drives any remote runtimes the board
uses. Nothing else is involved. When you close the app, the board stops — that
is the point: it is *your* board, running where you are.

**An external coordinator** is a separate process that owns the board on your
behalf — an hkp-node instance in the cloud, or one on a machine in your own
network. It provisions the board's runtimes itself and keeps them running with
nobody watching. Your browser or app then **attaches** to that board: it reads
what the board is doing and configures it, but it does not own it.

### Deploying moves ownership

You build a board in the playground, where your browser owns it. **Deploying**
hands it to a coordinator, which provisions the same runtimes itself and takes
over. From then on you attach to it rather than own it, and structural changes —
adding a runtime, reordering services — mean changing the board where you build
it and deploying again.

The rule that makes this safe is that ownership is never shared. Two owners would
each tear down what the other had just built, so a board is either yours or the
coordinator's, never both.

---

## The runtime

A runtime is where code actually runs. A board has one or more, and they are
**chained**: the output of one becomes the input of the next, in the order the
board lists them.

Coordinating a board and hosting a runtime are different jobs, even when one
program does both. Your browser coordinating a board *and* running its browser
services is the common case, not the general one.

### Choosing a runtime is a real decision

This is the part of HKP that is worth the most of your attention. The same step
in your app can often be placed in more than one runtime, and where you put it
changes three things:

**Where the data goes.** A runtime is a physical place. If a step runs in the
browser runtime on your laptop, its data never leaves your laptop. If it runs in
a runtime on a server, the data is on that server. You are not configuring a
privacy policy — you are deciding which machine the bytes are on. A board that
transcribes a private recording locally and only sends the resulting text
onwards is not a promise; it is what the board does.

**What it can reach.** A runtime can only touch what its host can touch. The
microphone, camera, and screen of the device you are holding. A sensor or an
audio interface plugged into it. Files on that machine. A printer, a synth, a
device on that network segment and nothing else. If your app needs a thing, it
needs a runtime on the host that has that thing.

**What it can afford.** Compute, memory, and the models or libraries that are
installed. A phone can drive a small speech model; a workstation can run a large
language model; a cheap cloud box can do neither but is always awake. Placement
is how you match the work to the hardware.

Every runtime speaks the same board vocabulary, so these are choices you make
per step, not once for the whole app. A single board routinely spans a phone, a
laptop, and a server, and the parts of it do not know which is which.

---

## The service

A service is the unit of work. It sits inside a runtime, receives data, and
produces data.

- It is **configured** when the board loads and again whenever you change one of
  its settings or switch its mode.
- It **processes** data handed to it by the service before it — or nothing at
  all, if it is the first in line.
- It may have several **modes** that change what processing means.
- Its **state** is persisted into the board document, which is why re-opening a
  board gives you back the app exactly as you left it.
- It may expose a **UI panel** for interactive configuration; services that
  don't provide one get a generic panel, so nothing is a black box.
- It may **emit on its own**, with no input at all — a timer ticking, an
  incoming request arriving, a stream producing a chunk.
- It can be **bypassed**, which leaves it in place but skips it.

### Services nest

Every runtime supports a service that contains its own ordered list of services.
This is how you build higher-level blocks: a handful of steps that belong
together become one thing you can name, reuse, and drop into another board.
Nested pipelines are also how branching and repetition are expressed — a service
that pattern-matches its input and runs one of several nested pipelines, or one
that repeats a nested pipeline until a condition stops it.

---

## Order is the program

There are no wires in HKP, and no wiring UI. The ordered list *is* the flow, at
both levels:

- **Within a runtime**, each service is called in listed order, and the output of
  one is the input of the next.
- **Across the board**, when a runtime's last service has produced a result,
  that result becomes the input of the next runtime in the list.

Explicit wires are the `goto` of dataflow: they work, and they make a program you
cannot read. A list you read top to bottom is a program you can reason about,
and — just as importantly — one an AI can extend without understanding the rest
of your app.

Here is a real, complete board. It has two runtimes and three services, and you
can already tell exactly what it does and in what order:

```json
{
  "boardName": "Text Generation Demo",
  "runtimes": [
    { "id": "ui", "name": "Browser", "type": "browser" },
    { "id": "python", "name": "hkp-python", "type": "rest",
      "url": "http://127.0.0.1:8080" }
  ],
  "services": {
    "ui": [
      { "uuid": "prompt-svc", "serviceName": "Prompt" }
    ],
    "python": [
      { "uuid": "llm-svc", "serviceName": "Text Generation" },
      { "uuid": "monitor-svc", "serviceName": "Generated Text" }
    ]
  }
}
```

You type a prompt in the browser. The browser runtime finishes with that text as
its result, so the text becomes the input of the next runtime. There, the text
generation service produces an answer and hands it to the monitor beside it.

### The hop is invisible

Notice what the board does *not* say. It never says "now send this over the
network." Handing a result to the next runtime is one operation, and it looks
identical whether the next runtime is a function call away in the same process
or a machine on another continent. Connections, retries, serialising audio
buffers into bytes and back — all of it is the framework's problem, not yours
and not your services'.

That is what makes placement a decision you can revisit. Moving a step from your
laptop to a server is moving it in the list; nothing in the board or in the
services has to be rewritten to match.

### Not every step goes forward

The straight line is the default, not the only option. A service can stop the
flow, so nothing after it runs. It can jump the queue and return a result
directly, skipping the services that follow it. And it can turn the flow around
entirely: refuse to pass anything on, then call the rest of the pipeline itself
and do something with what comes back. A cache is the classic example — on a hit
it returns the cached value immediately, and on a miss it lets the services
downstream fetch the real one, catches the result on its way past, and stores it.

These are covered properly in the service chapter. The point here is that
control flow lives inside services, alongside everything else — there is no
separate layer of conditionals wrapped around your app.

---

## What crosses a runtime boundary

Because a runtime is a physical place, it is worth being precise about what
actually leaves one.

In normal operation, two things cross:

- **The result** a runtime hands to the next runtime in the chain. This is the
  flow you designed; it is the whole point.
- **Configuration** you set on a service, and the state that service reports
  back. The coordinator keeps the last reported state of every service, which is
  how whole-board questions get answered. Treat service state as visible across
  the board.

Everything else that happens inside a runtime — the intermediate values passing
between its services — stays there. A runtime is a box you can close.

**With one exception you control.** When you attach a UI to a runtime so you can
watch it work, that runtime starts reporting what each of its services is doing:
not just the outputs, but the input handed to every service as well. That is
what makes the panels live, and it is exactly what you want while you are
building. It also means that while something is attached, the runtime's internal
traffic is leaving it.

When nothing is attached, nothing is reported — this is not a filter applied
afterwards, the runtime simply does not send. So it is a property you can plan
around: keep a sensitive stage in a runtime you don't attach a UI to, and its
intermediate data stays put.

One caveat worth knowing up front: a **deployed** board's coordinator keeps its
own connection to every runtime it provisioned, because that is how it stays in
touch with them. On a deployed board, therefore, assume there is always a
listener. If a step's intermediate data must never leave its machine, keep that
step on a board you own yourself.

---

## The pieces together

### Anatomy of a board

<svg viewBox="0 0 780 340" width="100%" role="img" aria-labelledby="d1t" style="max-width:780px;color:#1f2328">
<title id="d1t">A board containing a coordinator and two chained runtimes, each holding an ordered list of services</title>
<defs>
<marker id="arw1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="currentColor"/></marker>
</defs>
<rect x="12" y="12" width="756" height="316" rx="14" fill="currentColor" fill-opacity="0.025" stroke="currentColor" stroke-opacity="0.35"/>
<text x="34" y="44" font-family="sans-serif" font-size="15" font-weight="600" fill="currentColor">Board</text>
<text x="34" y="64" font-family="sans-serif" font-size="11.5" fill="currentColor" fill-opacity="0.6">one document · exactly one owner</text>
<rect x="524" y="28" width="222" height="30" rx="15" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-opacity="0.4"/>
<text x="635" y="47" font-family="sans-serif" font-size="12" text-anchor="middle" fill="currentColor">Coordinator — owns the board</text>
<rect x="34" y="90" width="310" height="222" rx="10" fill="none" stroke="currentColor" stroke-opacity="0.45"/>
<text x="54" y="118" font-family="sans-serif" font-size="12.5" font-weight="600" fill="currentColor">Runtime · Browser</text>
<text x="54" y="136" font-family="sans-serif" font-size="11" fill="currentColor" fill-opacity="0.6">runs in the app you are using</text>
<rect x="54" y="150" width="270" height="42" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-opacity="0.3"/>
<text x="189" y="176" font-family="sans-serif" font-size="12" text-anchor="middle" fill="currentColor">Service</text>
<line x1="189" y1="192" x2="189" y2="212" stroke="currentColor" stroke-opacity="0.6" marker-end="url(#arw1)"/>
<rect x="54" y="216" width="270" height="42" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-opacity="0.3"/>
<text x="189" y="242" font-family="sans-serif" font-size="12" text-anchor="middle" fill="currentColor">Service</text>
<text x="54" y="288" font-family="sans-serif" font-size="11" fill="currentColor" fill-opacity="0.6">listed order = the flow</text>
<rect x="434" y="90" width="310" height="222" rx="10" fill="none" stroke="currentColor" stroke-opacity="0.45"/>
<text x="454" y="118" font-family="sans-serif" font-size="12.5" font-weight="600" fill="currentColor">Runtime · elsewhere</text>
<text x="454" y="136" font-family="sans-serif" font-size="11" fill="currentColor" fill-opacity="0.6">a server, a phone, a machine on your LAN</text>
<rect x="454" y="150" width="270" height="42" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-opacity="0.3"/>
<text x="589" y="176" font-family="sans-serif" font-size="12" text-anchor="middle" fill="currentColor">Service</text>
<line x1="589" y1="192" x2="589" y2="212" stroke="currentColor" stroke-opacity="0.6" marker-end="url(#arw1)"/>
<rect x="454" y="216" width="270" height="42" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-opacity="0.3"/>
<text x="589" y="242" font-family="sans-serif" font-size="12" text-anchor="middle" fill="currentColor">Service</text>
<text x="454" y="288" font-family="sans-serif" font-size="11" fill="currentColor" fill-opacity="0.6">same vocabulary, different machine</text>
<line x1="348" y1="201" x2="428" y2="201" stroke="currentColor" stroke-opacity="0.75" stroke-width="1.5" marker-end="url(#arw1)"/>
<text x="388" y="192" font-family="sans-serif" font-size="10.5" text-anchor="middle" fill="currentColor" fill-opacity="0.7">result</text>
</svg>

### Two ways to own a board

<svg viewBox="0 0 780 366" width="100%" role="img" aria-labelledby="d2t" style="max-width:780px;color:#1f2328">
<title id="d2t">An internally coordinated board running inside your device, next to an externally coordinated board running in hkp-node with your device attached to it</title>
<defs>
<marker id="arw2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="currentColor"/></marker>
</defs>
<text x="14" y="28" font-family="sans-serif" font-size="13" font-weight="600" fill="currentColor">Internal coordinator</text>
<rect x="12" y="40" width="356" height="256" rx="12" fill="currentColor" fill-opacity="0.025" stroke="currentColor" stroke-opacity="0.3"/>
<rect x="34" y="66" width="312" height="208" rx="8" fill="none" stroke="currentColor" stroke-opacity="0.45"/>
<text x="52" y="92" font-family="sans-serif" font-size="12" font-weight="600" fill="currentColor">Your device — playground or Readymade</text>
<rect x="52" y="106" width="200" height="30" rx="15" fill="currentColor" fill-opacity="0.09" stroke="currentColor" stroke-opacity="0.4"/>
<text x="152" y="126" font-family="sans-serif" font-size="12" text-anchor="middle" fill="currentColor">Coordinator</text>
<rect x="52" y="152" width="276" height="52" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-opacity="0.3"/>
<text x="190" y="183" font-family="sans-serif" font-size="12" text-anchor="middle" fill="currentColor">Runtimes · services · UI</text>
<text x="52" y="234" font-family="sans-serif" font-size="11" fill="currentColor" fill-opacity="0.65">Owns the board and hosts it.</text>
<text x="52" y="252" font-family="sans-serif" font-size="11" fill="currentColor" fill-opacity="0.65">Close the app and the board stops.</text>
<text x="414" y="28" font-family="sans-serif" font-size="13" font-weight="600" fill="currentColor">External coordinator</text>
<rect x="412" y="40" width="356" height="256" rx="12" fill="currentColor" fill-opacity="0.025" stroke="currentColor" stroke-opacity="0.3"/>
<rect x="434" y="60" width="312" height="118" rx="8" fill="none" stroke="currentColor" stroke-opacity="0.45"/>
<text x="452" y="84" font-family="sans-serif" font-size="12" font-weight="600" fill="currentColor">hkp-node — cloud or your LAN</text>
<rect x="452" y="96" width="180" height="28" rx="14" fill="currentColor" fill-opacity="0.09" stroke="currentColor" stroke-opacity="0.4"/>
<text x="542" y="115" font-family="sans-serif" font-size="12" text-anchor="middle" fill="currentColor">Coordinator</text>
<rect x="452" y="132" width="276" height="30" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-opacity="0.3"/>
<text x="590" y="152" font-family="sans-serif" font-size="12" text-anchor="middle" fill="currentColor">Runtimes · services</text>
<rect x="434" y="206" width="312" height="68" rx="8" fill="none" stroke="currentColor" stroke-opacity="0.45"/>
<text x="452" y="230" font-family="sans-serif" font-size="12" font-weight="600" fill="currentColor">Your device</text>
<text x="452" y="252" font-family="sans-serif" font-size="11" fill="currentColor" fill-opacity="0.65">attaches — reads and configures, does not own</text>
<line x1="600" y1="206" x2="600" y2="174" stroke="currentColor" stroke-opacity="0.7" stroke-dasharray="4 3" marker-end="url(#arw2)"/>
<text x="612" y="194" font-family="sans-serif" font-size="10.5" fill="currentColor" fill-opacity="0.7">attach</text>
<path d="M 190 302 C 190 334, 590 334, 590 302" fill="none" stroke="currentColor" stroke-opacity="0.6" stroke-width="1.5" marker-end="url(#arw2)"/>
<text x="390" y="352" font-family="sans-serif" font-size="11" text-anchor="middle" fill="currentColor" fill-opacity="0.75">deploying — the coordinator takes over and keeps it running</text>
</svg>

### One trigger through a board

<svg viewBox="0 0 780 252" width="100%" role="img" aria-labelledby="d3t" style="max-width:780px;color:#1f2328">
<title id="d3t">A trigger entering the first service of the browser runtime, its result crossing the runtime boundary, and two further services running in the next runtime</title>
<defs>
<marker id="arw3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="currentColor"/></marker>
</defs>
<text x="12" y="118" font-family="sans-serif" font-size="11" fill="currentColor" fill-opacity="0.7">you type</text>
<line x1="14" y1="130" x2="64" y2="130" stroke="currentColor" stroke-opacity="0.75" stroke-width="1.5" marker-end="url(#arw3)"/>
<rect x="72" y="62" width="230" height="138" rx="10" fill="none" stroke="currentColor" stroke-opacity="0.45"/>
<text x="88" y="86" font-family="sans-serif" font-size="12" font-weight="600" fill="currentColor">Runtime · Browser</text>
<rect x="88" y="104" width="198" height="48" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-opacity="0.3"/>
<text x="187" y="133" font-family="sans-serif" font-size="12" text-anchor="middle" fill="currentColor">Prompt</text>
<text x="88" y="180" font-family="sans-serif" font-size="10.5" fill="currentColor" fill-opacity="0.6">on your machine</text>
<line x1="336" y1="44" x2="336" y2="216" stroke="currentColor" stroke-opacity="0.28" stroke-dasharray="4 4"/>
<text x="336" y="238" font-family="sans-serif" font-size="10.5" text-anchor="middle" fill="currentColor" fill-opacity="0.65">runtime boundary — same call either way</text>
<line x1="306" y1="130" x2="366" y2="130" stroke="currentColor" stroke-opacity="0.75" stroke-width="1.5" marker-end="url(#arw3)"/>
<text x="336" y="118" font-family="sans-serif" font-size="10.5" text-anchor="middle" fill="currentColor" fill-opacity="0.7">result</text>
<rect x="370" y="62" width="396" height="138" rx="10" fill="none" stroke="currentColor" stroke-opacity="0.45"/>
<text x="386" y="86" font-family="sans-serif" font-size="12" font-weight="600" fill="currentColor">Runtime · hkp-python</text>
<rect x="386" y="104" width="168" height="48" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-opacity="0.3"/>
<text x="470" y="133" font-family="sans-serif" font-size="12" text-anchor="middle" fill="currentColor">Text Generation</text>
<line x1="556" y1="130" x2="574" y2="130" stroke="currentColor" stroke-opacity="0.75" stroke-width="1.5" marker-end="url(#arw3)"/>
<rect x="578" y="104" width="172" height="48" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-opacity="0.3"/>
<text x="664" y="133" font-family="sans-serif" font-size="12" text-anchor="middle" fill="currentColor">Generated Text</text>
<text x="386" y="180" font-family="sans-serif" font-size="10.5" fill="currentColor" fill-opacity="0.6">wherever you decided to put the model</text>
</svg>

---

## Design principles

- **Composable first.** Services combine into nested pipelines, pipelines into
  boards, boards into apps. When you reach for a new service, the useful
  question is whether it composes with what you already have.
- **Structured flow over wires.** The ordered list is the flow. Branching and
  repetition are services, not a separate diagramming layer.
- **Scoped by concept, not by technique.** A service covers a domain, not an
  implementation. Two different technologies serving the same idea belong in one
  service with two modes. Complexity belongs in composition, not inside a single
  service.
- **Observable.** Every service has inspectable state and a panel. Nothing is a
  black box — and you decide when it is being watched.
- **Working and iterable over optimal.** The goal is something you can poke,
  adjust, and hand to an AI to evolve.
- **AI-collaborative.** Because a service is small and self-contained, an AI can
  write or change one without holding your whole app in its head. You stay in
  control at the concept level.

---

## Where to go next

- [Runtimes](./runtimes.md) — the four runtimes, what each one is distinctively
  good at, where a runtime can live, and how to choose.
- **The service contract** — what a service can ask of the runtime hosting it
  and the board it lives on, how nested pipelines work, and the full set of
  control-flow options.
- **Service reference** — every service, mode, and setting.
