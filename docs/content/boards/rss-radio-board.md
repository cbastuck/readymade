# Reading Radio

A reading list, read aloud and served as audio. Four units — a reader, a voice,
a radio and a library — each of which runs and can be tested on its own, held
together by nothing thicker than a feed URL and two
[mount references](../concepts/mounts.md).

## What it does

It turns anything that publishes RSS or Atom into a podcast. Articles are
collected into a reading list, the list is published as a feed of its own, a
voice reads anything not yet spoken, and the resulting audio is served at an
address you can point a player at.

## The four units

This board declares no runtimes. It is a [composition](../concepts/units.md):

| As | Unit | What it is |
|---|---|---|
| `reader` | `rss-demo-board.json` | Feeds in, a reading list out, published as a feed |
| `voice` | [Radio Voice](./rss-radio-board.md#voice) | A text-to-speech endpoint, and nothing else |
| `radio` | [Radio](./rss-radio-board.md#radio) | Reads a feed, skips what it has spoken, calls the voice |
| `library` | [Radio Library](./rss-radio-board.md#library) | Serves the audio, read-only |

What holds them together is deliberately thin, and **it is not a wire**. The
radio reads the reader's output *as a feed*, which is why it does not know the
reading list is a SQL table — or that there is a reading list at all. Give it
any feed and it does the same thing. It reaches the voice and the library by
mount reference: a board names a service, and the
[coordinator](../concepts/coordinator.md) resolves the address when the board
loads. It shares the library's bytes by **naming the same volume**, the way two
boards share a database.

Each unit's runtimes keep the unit's own board name, so a unit composed here is
the same to a server as a unit opened alone — the same endpoints, the same
tables. What the composition qualifies is the runtime id, which is why the voice
is addressed as `voice.speech` here and as `speech` when it runs by itself.

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
drift. An item claimed but never finished is offered again once its claim goes
stale, so a voice that was down for an hour costs a delay rather than a silence
nobody notices.

**The path comes back with the audio**, in a header the voice sets, because an
answer arriving later than the pass that asked for it has to say what it is an
answer to.

A round asks the feed for its ten newest and lets the claim decide which are
work. Nothing limits the iteration itself, because an
[Iterator](../services/iterator.md) would cut the list before the claim saw it,
and an article below the cut would never get another turn.

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

Needs hkp-node on port 8080 and hkp-python on port 9000, the latter with the
speech and mp3 extras: `pip install "hkp-python[tts,mp3]"`. The first call
downloads the Kokoro model (~310 MB) and takes a while; later ones do not.
