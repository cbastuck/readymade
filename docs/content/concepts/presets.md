# Presets

A service's configuration as a file: written once, shared, and applied to any
service of that kind on any runtime that hosts it.

---

## The problem

Picking a service takes a second. Configuring it takes the afternoon.

`http-client` is the clearest case. Adding one is trivial; making it call
ElevenLabs is a URL, a path with a voice id in it, three headers one of which
carries a key, a query parameter for the audio format, and a JSON body in the
shape that API expects. None of that is *your* work — it is the same for
everybody who calls that API, and it is written down in a reference manual
somewhere. It is also, today, the part that cannot be handed to anyone:
sharing it means sharing the whole board built around it.

A board is the wrong unit for this. A board is an app. What a person wants to
pass along is much smaller: *this service, set up this way.*

---

## What a preset is

A JSON document naming a service and carrying its state:

```json
{
  "preset": "v1",
  "id": "elevenlabs-text-to-speech",
  "name": "ElevenLabs — Text to speech",
  "serviceId": "http-client",
  "serviceName": "ElevenLabs TTS",
  "description": "Renders text as speech …",
  "runtimes": ["rest"],
  "secrets": {
    "elevenlabs": {
      "label": "ElevenLabs API key",
      "url": "https://elevenlabs.io/app/settings/api-keys"
    }
  },
  "state": {
    "url": "https://api.elevenlabs.io",
    "path": "/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM",
    "method": "post",
    "query": { "output_format": "mp3_44100_128" },
    "headers": {
      "xi-api-key": "{{secret.elevenlabs}}",
      "content-type": "application/json",
      "accept": "audio/mpeg"
    },
    "body": "{\"text\": \"…\", \"model_id\": \"eleven_multilingual_v2\"}",
    "timeoutMs": 30000
  }
}
```

| Field         | Required | What it is                                                                  |
| ------------- | -------- | --------------------------------------------------------------------------- |
| `preset`      | yes      | Format marker. `"v1"`, and how a preset file is recognised at all           |
| `serviceId`   | yes      | The service this configures. Not a runtime                                  |
| `name`        | yes      | What it is called in a menu                                                 |
| `state`       | yes      | The service's **whole** configuration                                       |
| `id`          | no       | Stable identity, unique per service. Derived from the name when absent      |
| `serviceName` | no       | Names the instance when applied, and the palette card that offers it. Defaults to the preset's name when saved from a service |
| `description` | no       | What it does, and what it expects on its input                              |
| `version`     | no       | The author's revision of this preset. Not the format version                |
| `author`, `homepage` | no | Who wrote it, and where the API is documented                          |
| `tags`        | no       | What it *is* — the second axis the browser files it under                   |
| `runtimes`    | no       | The runtime classes it suits — a hint shown to a person, never a restriction |
| `secrets`     | no       | Display information for the aliases `state` refers to, keyed by alias       |

A file holds one preset, or several under `{"presets": [ … ]}`.

### It is keyed by service, not by runtime

`http-client` exists on hkp-node and on hkp-rt with the same state contract, so
one preset applies wherever the service is hosted. Matching is by the
**canonical** service id: the browser's legacy `hookup.to/service/*` ids are
aliases of the bare slugs the runtimes are converging on, and they stay, so both
spellings name one service everywhere a preset is filed, listed or applied. `runtimes` says which side a
preset is *meant* for — an API that sets no CORS headers, or a call carrying a
credential, wants a remote runtime rather than the browser — but it is advice
printed next to the name, not a rule that stops anything.

### No runtime knows presets exist

Applying one is an ordinary `configure` call. There is no preset support in
hkp-node, hkp-rt, hkp-python or hkp-go, and none is needed: presets are a
document format and a step in the playground.

---

## Applying replaces, it does not merge

Applying a preset produces *exactly* the preset's configuration. Never a mix of
it and whatever the service happened to hold.

A half-applied preset is the worst of the available outcomes. A header or a
body left behind from a previous API silently breaks the request, while the
board looks exactly as the preset says it does. So `state` is the service's
whole configuration, and applying one resets the service first.

There is no cross-runtime "reset to defaults" call to do that with, and there
should not be one — the runtime already knows how to build a fresh service, and
that is what restoring a board does to every service it loads. Applying a
preset therefore **recreates the instance**: removed, created again under the
same uuid and at the same position, then configured. Facade widgets reference a
service by uuid and a [mount](mounts.md) address is derived from one, so keeping
it is what makes this an edit of a service rather than a replacement of it.

**Order matters, and it is the part that breaks quietly.** The new instance is
configured *before* the board is told it exists. A service panel initialises
itself once per service object — it reads the configuration the first time it
sees one, and after that only listens for notifications. Publish first and the
panel meets the instance in the gap between its creation and its configuration:
it shows the defaults, never hears the configure that follows, and the preset is
applied while the panel says it is not.

Two things survive that a preset does not touch:

- **`__hkp*` state**, which belongs to board machinery rather than to the
  service holding it — `__hkpMount` is an address a coordinator published onto
  this instance. It is lifted off the old instance and put back on the new one.
- **The service's name**, unless the preset gives a `serviceName`.

---

## Secrets travel as references

A preset holds `{{secret.elevenlabs}}`, the same reference a board holds. The
value is resolved at the point of use and never enters service state (see
[secrets](../board-json.md)), which is what makes a preset safe to publish:
there is nothing in the file to redact.

The aliases a preset needs are **derived from its state**, not declared — the
state is where an alias is actually used, so the list cannot fall out of step
with what the preset does. The optional `secrets` block only says how to
describe one to a person: what the key is called, and where to get one.

A preset applies whether or not the key exists on this device. The panel says
which alias is missing; it does not refuse to configure the service, because the
preset is correct either way and the key is a separate errand.

---

## Where presets come from

Two origins, no difference in how they apply:

- **Built in** — shipped with the build, under `hkp-frontend/presets/<serviceId>/`
  and listed in `hkp-frontend/src/presetRegistry.ts`. The equivalent of the demo
  boards, and not deletable: there is nothing on the device to delete.
- **Kept on this device** — imported from a disk or a URL, or saved from a
  service that was already configured the way someone wanted to keep it. Stored
  in `localStorage`.

A preset fetched from a URL is fetched from whatever address serves the file; a
GitHub page link is rewritten to the raw file behind it, so pasting the page you
are looking at works.

---

## Two axes: the service, then what it is

A preset is filed under **the service it configures**. That is the axis that
decides what can be done with it — an `http-client` preset is applicable to an
`http-client` and to nothing else — and it is the list a service's own menu
shows.

For most services that is the whole answer. Every `http-client` preset is a
request to some API, so the service already says what its presets are.

**It is not the answer for `sub-service`.** A sub-service's state *is* a
pipeline, so a preset of one is a reusable building block made of other
services — a meta-service. What those building blocks *do* varies completely: a
Telegram responder, a spectral analyser, a geocoding lookup. They share a
serviceId and nothing else. Filed by service alone they would be one
undifferentiated bucket that only grows, and the more useful the mechanism is,
the worse the bucket gets.

So a preset says what it is, in `tags`:

```json
"tags": ["Messaging"]
```

and the browser puts a **tag column after the service column**:

```
Presets ▸ sub-service ▸ Messaging ▸ Telegram responder
                      ▸ Audio     ▸ Spectral analyser
```

Tags work the way the folders in the board browser work: a preset with tags
lives in each of its tag folders, and a preset with none sits in the service
folder itself — the way an unfiled board sits at the root of its source. So the
column appears exactly where someone has said something, and a service whose
presets are untagged still reads as a plain list. That is why the two presets
this build ships carry no tags: two of them are a list, not a filing problem.

Tags are compared without case — `Messaging` and `messaging` are one tag, not
two folders that look alike — and kept in the spelling they first arrived in.

**A tag is part of the file.** Refiling a preset rewrites it, which is what makes
the filing travel: someone who imports your building block gets it filed the way
you filed it. A preset is tagged when it is saved (the field is in the save
dialog) and re-tagged in the details column; a shipped preset's tags are part of
the build, like everything else about it.

### What a sub-service preset is, and is not

It is a pipeline, captured. Applying one rebuilds that pipeline inside the
sub-service, because applying any preset replaces the service's whole state.

It is less portable than a simple preset, for two reasons that are worth telling
apart. The state names the nested services and carries their state, so a
composed preset can only be applied where those services **exist** — that is
real, and permanent, and `runtimes` is where to say which side it is meant for.

The other reason is temporary: the browser's older service ids carry a
`hookup.to/service/` prefix where the backend runtimes use a bare slug, so the
same nested service is spelled two ways. The runtimes are converging on the bare
slug, and the prefixed ids stay as aliases so existing boards keep loading.
Anything asking *is this the same service* therefore asks it of the canonical id
— which is what the Presets source files by, what a service's menu matches on,
and what applying one checks — so a preset authored against either spelling
applies to the other. Neither a board nor a preset is rewritten; they keep the
id they were authored with.

---

## Where presets are used

**Organising them is the start page's job.** The Presets source lists a folder
per service that has one, and the presets themselves as the leaves — the same
browser the boards are organised in, with a details column saying where a preset
came from, what it needs, and what is in it, and the actions that belong to a
file: export it, delete it. Importing one is the source's own action.

**A composed preset is a building block, and sits in the palette.** A preset of
`sub-service` is a pipeline someone built and kept — a service made of services
— so the sidebar lists it beside the primitives, as a card of its own under its
own name, dragged onto a runtime the same way. Dropping one creates the
sub-service, names it after the preset and configures it from the preset, in
that order: a panel reads a service's configuration once, when it first sees the
instance, so the configure has to happen before the board is told the service
exists.

A card *is* the preset, so it carries the preset's name — not `serviceName`,
which is the name a preset gives a service it is **applied** to, and which a
preset captured from a service inherits from it (a second card called
"SubService", beside the SubService primitive it came from).

What is published to the board is the state the service holds after the
configure, not the one its runtime answered the create with. A nested pipeline
is rendered straight off the board's descriptor, so publishing the create's
answer leaves a sub-service showing as empty while its runtime holds the whole
pipeline — right in the configuration dialog, wrong on the board.

A card appears only where the runtime has a `sub-service` to put it in, and only
where the preset belongs — `runtimes` is how a composed preset says which side
it was built for, since it names nested services that one registry has and
another may not.

**Picking one is the playground's job.** A service's menu has a *Presets*
submenu listing what is available for that service and nothing else. The menu
answers one question — which preset do I want on this service — and a list of
names is the whole of that answer; a panel there would be a second place to
manage the same files.

The one action that cannot live on the start page is the reverse direction:
what is worth keeping is a service someone has working in front of them, and
that only exists in a board. So *Save configuration…* sits at the foot of the
same submenu, and what it produces is an ordinary preset on this device — in the
Presets source, in every menu for that service, and exportable as a file, which
is the only form in which it reaches anybody else.

The two surfaces read one list. The store says when it changes, because
`localStorage` reports nothing to the tab that wrote it, and a preset imported on
the start page has to appear in the playground's menu without a reload.

---

## Presets, sub-services and units

A `SubService`'s state *is* its pipeline, so a preset of one is a reusable
pipeline — several services, wired in order, as one file. This needs no second
mechanism: it is an ordinary preset whose `state` happens to contain a list of
services. What it needs is a way to say what it is, which is what tags are for.

That is a different thing from [units](units.md), which assemble whole
*runtimes* into a board. A preset never crosses a service boundary; a unit never
reaches inside one.
