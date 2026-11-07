# Reading Radio

A reading list, read aloud and served as audio. Five units — a reader, an
editor, a voice, a radio and a library — each of which runs and can be tested on
its own, held together by nothing thicker than two feed URLs and two
[mount references](../concepts/mounts.md).

## What it does

It turns anything that publishes RSS or Atom into a podcast. Articles are
collected into a reading list, the list is published as a feed of its own, an
editor reads each article and writes a short brief of it, a voice reads the
title and the brief of anything not yet spoken, and the resulting audio is
served at an address you can point a player at.

## The five units

It is a [composition](../concepts/units.md) of five units, and declares one
runtime of its own — the desk the lanes below read:

| As | Unit | What it is |
|---|---|---|
| `reader` | `rss-demo-board.json` | Feeds in, a reading list out, published as a feed |
| `editor` | [Radio Editor](./rss-radio-board.md#editor) | A feed in, the same feed out with a brief of each article |
| `voice` | [Radio Voice](./rss-radio-board.md#voice) | A text-to-speech endpoint, and nothing else |
| `radio` | [Radio](./rss-radio-board.md#radio) | Reads a feed, skips what it has spoken, calls the voice |
| `library` | [Radio Library](./rss-radio-board.md#library) | Serves the audio, read-only |

What holds them together is deliberately thin, and **it is not a wire**. The
radio reads the editor's output *as a feed*, and the editor reads the reader's
the same way, which is why neither knows the reading list is a SQL table — or
that there is a reading list at all. Give either any feed and it does the same
thing. That is also how the editor was added: placed between two units that
already spoke feeds, with nothing in the radio changed but the address it
reads. It reaches the voice and the library by
mount reference: a board names a service, and the
[coordinator](../concepts/coordinator.md) resolves the address when the board
loads. It shares the library's bytes by **naming the same volume**, the way two
boards share a database.

Each unit's runtimes keep the unit's own board name, so a unit composed here is
the same to a server as a unit opened alone — the same endpoints, the same
tables. What the composition qualifies is the runtime id, which is why the voice
is addressed as `voice.speech` here and as `speech` when it runs by itself.

## The lanes

The lanes are the board's only face: the units' own facades are for opening
each unit alone, and a composition shows none of them (`"view": false`). The
board's face follows one article from the feed it came from to the
audio it became, in five [swimlanes](./swimlanes-demo-board.md):

| Lane | A card here is | What you can do |
|---|---|---|
| **Sources** | a feed the reader subscribes to | add one, unsubscribe |
| **Items** | an article in a feed, not yet kept | drag it onto the reading list |
| **Reading list** | a kept article, waiting for the editor, being briefed, or failed | Retry or Use the feed's line on a failed one; drag it back to drop it |
| **Briefed** | an article with its brief, waiting for the radio, being voiced, or whose audio failed | read the brief; Retry failed audio |
| **On air** | an article the radio has read aloud | play it on the card; Forget it |

Under the lanes are the two addresses the board publishes for use elsewhere:
**the reading list as a feed**, for any RSS reader, and **On air as a
playlist**, an M3U of everything voiced, newest first, for VLC, Music or any
desktop player.

The lane *is* the state: done is the next lane, and a card says only what is
happening to it where it is — *waiting*, *briefing*, *failed* and why. Moving a
card is the system's everywhere except onto the reading list and back off it.

What makes that possible without merging the units is that **the reader, the
editor and the radio share one database here** — `reading-radio`, set as each
unit's `database` param. Each keeps its own table, `article`, `brief` and
`episode`, and its own contract: opened alone, each unit uses a database of its
own and works on any feed it is given. Composed, the three tables sit side by
side, and one query in the board's `desk` runtime joins them on the article's
link and says for every article which lane it is in. It is re-read every five
seconds and after every action a card offers, so nothing needs refreshing.

That query declares the three tables itself, copied from the units, so the lanes
work before any unit has created its table. A unit changing its table changes
the copy here too.

## Radio

*A feed, read aloud.* Every minute it reads the feed it was given; anything it
has not spoken before is sent to a voice and the audio kept in the library.

The feed is the only thing it knows about its source, and that is what makes it
general. Two things in its pipeline are worth reading closely.

**The claim** is one [SQL](../services/sql.md) statement doing the work of a
lease. It takes the item and hands back *nothing at all* when the item is
already spoken or is being spoken right now — and returning nothing
[stops that pass](../concepts/runtime.md#control-flow), which is how work is
skipped without a conditional. It also gives back the path the episode is to be
kept at, built from the item's identity rather than from a counter that would
drift. Nothing is taken again by itself.

**A voice that fails is recorded, not retried.** The call to the voice is a
[Join](../services/join.md) that reports a failure beside the article
([`onFailure: "merge"`](../services/join.md#when-the-detour-fails)), and a
[Tracks](../services/tracks.md) branches on what came back: one track keeps the
audio — only a `200` carrying bytes — and the other writes down why there is
none, in a `voicing` table beside the ledger: the voice's error, *the voice
answered HTTP 503*, *the voice answered without audio*. Each track stops itself
when it is not the one that applies. A failed article waits under **Being
read**, and in the lanes, until somebody presses Retry; one that started and
never finished counts as failed after `stuckAfter` (fifteen minutes).

**The path comes back with the audio**, in a header the voice sets, because an
answer arriving later than the pass that asked for it has to say what it is an
answer to.

**Forgetting an episode** is the claim run backwards, in a runtime of its own:
*Remove* beside an episode in the Listen panel's player deletes its row from the ledger
and its audio from the library, and what that leaves behind runs on into the
playlist, so the list redraws without being asked. Because the claim is the
only memory of what was spoken, an article still on the reading list is simply
work again on the next round — removing a broken episode is how it gets read
again. The runtime sits in the chain between the published feed and the
playlist, so its first step lets through only a request naming an episode;
the feed's answer, which arrives there every minute, stops at it.

A round asks the feed for its ten newest and lets the claim decide which are
work. Nothing limits the iteration itself, because an
[Iterator](../services/iterator.md) would cut the list before the claim saw it,
and an article below the cut would never get another turn.

## Editor

*A feed, briefed.* Every minute it reads the feed it was given; any article it
has not read before is fetched, read by a language model, and given a brief of
two to four sentences written to be heard rather than read. What it publishes is
the same feed again, with the brief where the feed's own line was — which is the
text the radio speaks after the title.

**An article reaches the published feed only once its brief is written.** That
is the whole of its contract with the radio: the radio never sees an article
before the editor has read it, so it never speaks one without its brief.

**The claim** is one SQL statement that takes an article the editor has not
seen or hands back nothing, so an article already briefed, being briefed, or
failed stops its own pass. Nothing is taken again by itself.

**Two detours, one after the other.** The page is fetched and its text taken out
of the HTML; then the title, the feed's line and that text go to the model. Each
is a [Join](../services/join.md), so each comes back *beside* the article rather
than instead of it — which is how the brief still knows which article it
belongs to when it is filed. The fetch names its address in the request
([`meta.url`](../services/http.md#a-request-that-says-where-it-is-going)),
because every article lives somewhere else.

**A page that cannot be read is not a failure.** A 404, a paywall, a PDF, a
site that never answers: the model is told the article could not be read, and
briefs from the title and the feed's line alone — saying less rather than
guessing. The desk says so beside the brief, with what happened to the page.

**A brief that fails is recorded, not retried.** The second detour reports a
failure beside the article instead of stopping
([`onFailure: "merge"`](../services/join.md#when-the-detour-fails)), and the
last step files either the brief or the reason it is missing. A failed article
stays on the desk with that reason — *Failed: API returned HTTP 401*, *Failed:
the model used all 2000 tokens without answering* — and waits for a person:
**Retry** runs that one article through the pipeline again, and **Use the feed's
line** publishes it with the line its feed gave it, which the radio then reads
like any brief. A brief that started and never finished — a runtime restarted
mid-way — counts as failed after `stuckAfter` (ten minutes), so nothing says
"briefing" forever.

The model is Claude on hkp-node's `anthropic`
[backend](../services/text-generation.md), with the key from the secret
`anthropic.key`; with `apiKey` set to empty it uses `ANTHROPIC_API_KEY` from
the runtime's environment instead. Setting the unit's `backend` param to `server`, `serverUrl` to
an OpenAI-compatible server and `apiKey` to empty briefs with a local model
instead, and nothing else in the board changes.

## Voice

*A voice, as an endpoint.* POST `{"path": "episodes/x.mp3", "text": "…"}` and
the answer is that text spoken, as an mp3.

It keeps nothing and knows nothing about what it is reading: no feed, no
library, no idea what an episode is. That is what makes it reusable — anything
with text and somewhere to put audio can call it.

The answer carries the path it was asked about in an `x-episode-path` header,
because a caller holding many items needs to know which one came back. Inside, a
[Join](../services/join.md) is what carries that path across the speaking:
[text-to-speech](../services/text-to-speech.md) answers with audio rather than
with the request *and* the audio, so the request is kept beside the detour
rather than replaced by it.

When it cannot speak — the model is missing, the encoder is not installed — it
answers `502` with the reason as JSON, never `200` with something that is not
audio, so a caller can tell a rendering from a failure without opening the
bytes.

## Library

*A folder of audio, served.* Whatever is written into the volume it names is
readable over one address: ask the address itself for a listing, or a path under
it for the file, with the content type its extension means and range requests
answered so a player can seek.

It is the public half of the library and nothing else: its
[Storage](../services/storage.md) services are **read-only**, which is what
makes an unauthenticated endpoint safe to hand out. Writing happens through a
different instance, inside the Radio unit.

Storage names a place on the board rather than a place on a disk — what actually
holds the bytes is its nested pipeline,
[filesystem](../services/filesystem.md) here. Swapping that for something
speaking S3 changes nothing outside the service.

## Try it

Needs an hkp-node and an hkp-python, kept under the names `node` and `python`
in *Manage runtime servers* — both default to port 8080, so start one of them
on another (`PORT=9000 hkp-python`). The editor needs an Anthropic API key,
under **Settings → Secrets** as `anthropic.key`. hkp-python needs the
speech and mp3 extras, which a plain `uv sync` in hkp-python installs. The first call
downloads the Kokoro model (~310 MB) and takes a while; later ones do not.
