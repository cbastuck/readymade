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
| `serviceName` | no       | Names the instance when applied. Without one the service keeps its name     |
| `description` | no       | What it does, and what it expects on its input                              |
| `version`     | no       | The author's revision of this preset. Not the format version                |
| `author`, `homepage`, `tags` | no | Who wrote it, where the API is documented, how it is found     |
| `runtimes`    | no       | The runtime classes it suits — a hint shown to a person, never a restriction |
| `secrets`     | no       | Display information for the aliases `state` refers to, keyed by alias       |

A file holds one preset, or several under `{"presets": [ … ]}`.

### It is keyed by service, not by runtime

`http-client` exists on hkp-node and on hkp-rt with the same state contract, so
one preset applies wherever the service is hosted. `runtimes` says which side a
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

## Where presets are used

**Organising them is the start page's job.** The Presets source lists a folder
per service that has one, and the presets themselves as the leaves — the same
browser the boards are organised in, with a details column saying where a preset
came from, what it needs, and what is in it, and the actions that belong to a
file: export it, delete it. Importing one is the source's own action.

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

## Presets and sub-services

A `SubService`'s state *is* its pipeline, so a preset of a sub-service is a
reusable pipeline — several services, wired in order, as one file. This needs no
second mechanism: it is an ordinary preset whose `state` happens to contain a
list of services.

That is a different thing from [units](units.md), which assemble whole
*runtimes* into a board. A preset never crosses a service boundary; a unit never
reaches inside one.
