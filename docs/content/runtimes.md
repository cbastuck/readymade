# Runtimes

A runtime is where a piece of your app actually runs. Adding one to a board is
deciding that some of the work happens *there* — on this device, on that server,
on the machine in the studio with the audio interface plugged into it.

This chapter is about choosing. It does not describe how a runtime is
implemented or what its network interface looks like; it describes what each one
gives your board and how to pick between them.

If you have not read [Architecture](./architecture.md), start there — this
chapter assumes you know that runtimes are chained in board order and that
handing data between them is automatic.

---

## What a runtime gives your board

Three things, and it is worth separating them:

**A place.** Every runtime runs on some machine. That machine is where the data
your services handle physically is, what hardware they can reach, and what
compute they can spend. Placement is the decision; the runtime is how you
express it.

**A repertoire.** Each runtime carries the services it is good at. They overlap
in the middle — every runtime can time, transform, and monitor — and diverge at
the edges, which is the point. You pick a runtime partly for where it is and
partly for what it can do there.

**A connection you never have to think about.** Once a runtime is on the board,
the framework handles reaching it. You do not open connections, serialise data,
or handle reconnects, and your services contain no code that differs depending
on whether the next runtime is local or remote.

---

## The four runtimes

### Browser

**Runs inside the app you are already using** — a tab in the playground, or
Readymade on your desktop, phone, or tablet. There is nothing to install, no
address to configure, and nothing to keep running.

It is the only runtime that shares a process with the user interface, which
makes it the most immediate one: a control moves and the service knows straight
away, with no round trip. It also has by far the largest repertoire — most
services exist here first.

Reach for it for anything interactive: controls and displays, drawing, the
camera and microphone of the device someone is holding, files the user picks,
calls to web APIs under the user's own session, and any experiment you want to
iterate on quickly.

Its limits are the browser's own. No arbitrary filesystem access, no listening
for incoming connections, no native libraries, and it only runs while the app is
open. Work that must survive a closed tab belongs somewhere else.

### hkp-rt — the C++ runtime

**The performance and hardware runtime.** Two things make it distinctive.

The first is audio. hkp-rt is where sample buffers, FFT and inverse FFT,
transient detection, WAV files, and native audio input and output live. If your
board touches sound as sound rather than as a file to move around, it touches
hkp-rt.

The second is that it runs *natively on the device*, including inside Readymade.
The copy of hkp-rt embedded in the desktop and mobile apps is the same runtime as
a standalone one — which is how a board can use the machine's real audio hardware,
its filesystem, and its sensors while every byte stays on that machine.

It also hosts servers, so a board can receive incoming HTTP or WebSocket traffic
rather than only making outbound calls, and it can run language, speech, and
voice models in-process.

Two caveats worth knowing before you design around it. Whether the in-process
model backends are present depends on how that particular runtime was built —
they are switched off on mobile, where the footprint does not fit. Each of those
services also has a mode that talks to a model server instead, which is always
available. And native audio input and output are macOS-only today.

### hkp-node — the messaging and server-I/O runtime

**For talking to the outside world, and for being talked to.** Telegram in and
out, sending mail over SMTP, reading it over IMAP, HTTP in both directions, and
hosting endpoints other things can call.

It is a natural home for the parts of a board that should keep working when
nobody is looking: a bot that answers while you sleep, a mailbox that is watched,
an endpoint that accepts uploads. It is also the runtime that can act as an
external coordinator, so a board deployed to hkp-node often has an hkp-node
runtime in it too — related, but not the same thing.

### hkp-python — the model runtime

**For running open-source models yourself.** Text generation, speech-to-text,
text-to-speech, and intent routing, on hardware you chose, with weights you
control.

Every one of these services can either run the model in-process or point at a
model server. That choice matters more than it looks: in-process means the audio
or the prompt never leaves the machine, which is often the entire reason for
putting the step here.

### At a glance

| Runtime        | Runs                                          | Distinctively good at                                        |
| -------------- | --------------------------------------------- | ------------------------------------------------------------ |
| **Browser**    | in the app you are using                      | interaction, device media, breadth, fast iteration           |
| **hkp-rt**     | natively on a machine, incl. inside Readymade | audio, native hardware, heavy processing, hosting endpoints  |
| **hkp-node**   | on a server, awake                            | messaging, mail, outside-world I/O, receiving requests       |
| **hkp-python** | wherever you run it                           | language, speech, and voice models under your own control    |

---

## Not every service exists on every runtime

This is deliberate. A runtime carries what it is good at, so the set of services
is part of what you are choosing.

In practice the middle overlaps heavily. Timing, transforming, monitoring,
stopping a flow, and nesting a sub-pipeline exist everywhere, so the *shape* of a
board travels even when its specialities do not.

One practical wrinkle: the same idea can be named differently in different
runtimes. Browser services are identified as `hookup.to/service/stopper` while
the remote runtimes call the same thing `stopper`, and a few concepts have
genuinely different names on either side. Moving a service between runtimes
therefore means picking the equivalent service in the target runtime, not just
changing which list it sits in. The
[service reference](./services/monitor.md) is the authority on what exists
where.

---

## Where a runtime lives, and how your board finds it

A browser runtime needs nothing — it is already where you are. Every other
runtime is a program running somewhere, and the board reaches it by URL.

There are three places that program can be, and they are genuinely different
choices rather than three flavours of the same one:

<svg viewBox="0 0 780 250" width="100%" role="img" aria-labelledby="d4t" style="max-width:780px;color:#1f2328">
<title id="d4t">Three places a runtime can run: the same machine as the app, another machine on the same network, or a server in the cloud</title>
<defs>
<marker id="arw4" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="currentColor"/></marker>
</defs>
<rect x="12" y="40" width="240" height="150" rx="10" fill="currentColor" fill-opacity="0.03" stroke="currentColor" stroke-opacity="0.4"/>
<text x="32" y="28" font-family="sans-serif" font-size="12.5" font-weight="600" fill="currentColor">Same machine</text>
<text x="32" y="70" font-family="sans-serif" font-size="11.5" fill="currentColor" fill-opacity="0.75">The app and the runtime on</text>
<text x="32" y="88" font-family="sans-serif" font-size="11.5" fill="currentColor" fill-opacity="0.75">one device — often embedded</text>
<text x="32" y="106" font-family="sans-serif" font-size="11.5" fill="currentColor" fill-opacity="0.75">in Readymade itself.</text>
<text x="32" y="140" font-family="sans-serif" font-size="11" font-weight="600" fill="currentColor">Nothing leaves the device.</text>
<text x="32" y="164" font-family="sans-serif" font-size="10.5" fill="currentColor" fill-opacity="0.6">audio hardware · local files · sensors</text>
<rect x="270" y="40" width="240" height="150" rx="10" fill="currentColor" fill-opacity="0.03" stroke="currentColor" stroke-opacity="0.4"/>
<text x="290" y="28" font-family="sans-serif" font-size="12.5" font-weight="600" fill="currentColor">Your network</text>
<text x="290" y="70" font-family="sans-serif" font-size="11.5" fill="currentColor" fill-opacity="0.75">A second machine you own —</text>
<text x="290" y="88" font-family="sans-serif" font-size="11.5" fill="currentColor" fill-opacity="0.75">the studio Mac, a workstation,</text>
<text x="290" y="106" font-family="sans-serif" font-size="11.5" fill="currentColor" fill-opacity="0.75">a box in the corner.</text>
<text x="290" y="140" font-family="sans-serif" font-size="11" font-weight="600" fill="currentColor">Stays inside your walls.</text>
<text x="290" y="164" font-family="sans-serif" font-size="10.5" fill="currentColor" fill-opacity="0.6">the GPU · the hardware · the other room</text>
<rect x="528" y="40" width="240" height="150" rx="10" fill="currentColor" fill-opacity="0.03" stroke="currentColor" stroke-opacity="0.4"/>
<text x="548" y="28" font-family="sans-serif" font-size="12.5" font-weight="600" fill="currentColor">A server</text>
<text x="548" y="70" font-family="sans-serif" font-size="11.5" fill="currentColor" fill-opacity="0.75">Somewhere that is always on</text>
<text x="548" y="88" font-family="sans-serif" font-size="11.5" fill="currentColor" fill-opacity="0.75">and reachable from anywhere,</text>
<text x="548" y="106" font-family="sans-serif" font-size="11.5" fill="currentColor" fill-opacity="0.75">including by other people.</text>
<text x="548" y="140" font-family="sans-serif" font-size="11" font-weight="600" fill="currentColor">Awake without you.</text>
<text x="548" y="164" font-family="sans-serif" font-size="10.5" fill="currentColor" fill-opacity="0.6">bots · inboxes · public endpoints</text>
<line x1="252" y1="115" x2="268" y2="115" stroke="currentColor" stroke-opacity="0.5" stroke-dasharray="3 3"/>
<line x1="510" y1="115" x2="526" y2="115" stroke="currentColor" stroke-opacity="0.5" stroke-dasharray="3 3"/>
<text x="390" y="228" font-family="sans-serif" font-size="11" text-anchor="middle" fill="currentColor" fill-opacity="0.7">Further right, the more reach. Further left, the less the data travels.</text>
</svg>

A board records that choice as the runtime's `url`. Two conveniences exist for
the cases where an address cannot be written down in advance:

- **`HKP_RUNTIME_HOST`** (and `HKP_RUNTIME_URL`) are placeholders the host fills
  in when the board loads. Use them when a board should point at "the machine
  this is running on" rather than a fixed address — a board you share, or one
  that runs on a different device each time.
- **Readymade's own embedded runtime** is addressed through an internal name
  rather than a host and port, because it is always co-located with the app.
  Boards that use it stay correct on every machine that opens them.

On a local network, Readymade can also open a short discovery window and find
other Readymade instances nearby, which is how you point a board at a machine
whose address you never learn.

---

## When a runtime is not there

Worth knowing, because the failure is not subtle: **a board whose remote runtime
cannot be reached does not load partly — it fails to load and reports the
error.** The runtime server has to be running, reachable at that URL, and willing
to accept you before the board comes up.

So if a board that worked yesterday will not open, the runtime URL is the first
thing to check: the server is not running, the address changed, you are on a
different network, or you are not signed in to something that requires it.

A board is still portable in the sense that matters — the document is complete
and the same JSON opens anywhere — but "anywhere" means anywhere the runtimes it
names can be reached. A board built against a machine on your desk is a board
about your desk.

---

## Choosing, in practice

Some worked cases, to make the three axes concrete:

**Transcribing a private recording.** The audio should not leave the device, and
transcription needs a model. Put speech-to-text in a local runtime — hkp-rt
embedded in Readymade, or hkp-python on your own machine — running the model
in-process, and let only the resulting text continue to whatever comes next. The
privacy property is structural: there is no step in the board that sends audio
anywhere.

**A chat bot that answers while you sleep.** Nothing about it can live in a
browser, because there is no browser open. Messaging belongs in hkp-node on a
server, and the board wants deploying so a coordinator keeps it running.

**A live audio analyser with a UI.** Split it: audio capture and FFT in hkp-rt
where the sample buffers are, the display in the browser runtime where the user
is. The result crossing between them is the analysis, not the audio.

**A model too big for your laptop.** Put hkp-python on the machine that has the
memory — the workstation upstairs — and keep everything else where it was. Only
the prompt and the answer travel.

The pattern in all four: put each step where its data should be and where its
work can happen, and let the board carry the results between them.

---

## Where to go next

- [Architecture](./architecture.md) — boards, coordinators, and why order is the
  program.
- **The service contract** — what a service can ask of the runtime hosting it,
  nested pipelines, and control flow.
- [Service reference](./services/monitor.md) — every service, mode, and setting.
