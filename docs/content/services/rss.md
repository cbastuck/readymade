# RSS

Several syndication feeds read as one list, newest first.

---

## Available in

| Runtime | Service ID |
|---|---|
| Node.js (hkp-node) | `rss` |

---

## What it does

RSS holds a list of feed URLs, fetches them, and emits their articles as one
array sorted newest first. RSS 2.0, RSS 1.0 (RDF) and Atom all read the same
way: the three formats say the same few things under different names, and the
service reduces them to one article shape.

A reader's unit is not the feed, it is the article. The question being asked is
*what is new*, and the answer spans everything subscribed to — so the feeds are
fetched together and merged rather than read one after another. A board that
wants one feed asks for one feed; nothing about the contract changes.

### Why it is not a browser service

A feed is served by whoever publishes it, and almost none of them send the
`Access-Control-Allow-Origin` header a browser would need to read one. Fetching
arbitrary feeds is therefore something a board can only do from a runtime that
is not a browser. That is a fact about how feeds are published, not a
preference — a browser-side version of this service would work for the handful
of feeds whose publisher happened to opt in, and fail for the rest.

### One slow feed costs its own rows

The feeds are fetched concurrently and their failures are kept apart. A feed
that is down, slow, or no longer a feed produces an entry in `errors` and the
others still arrive. A reader missing one source is still a reader; one showing
nothing because a single site is having a bad morning is not.

---

## The article shape

| Field | What it is |
|---|---|
| `id` | The feed's own identity for the item — `guid`, `id`, or the link |
| `title` | The headline |
| `link` | Where to read it; `""` when the feed offered no readable address |
| `author` | Who wrote it, where the feed says |
| `summary` | A line about it, with its markup stripped, trimmed to `summaryChars` |
| `published` | When, ISO 8601; `""` when the feed did not say |
| `publishedMs` | The same instant in epoch milliseconds — what the sort uses |
| `publishedLabel` | The same instant as `YYYY-MM-DD HH:mm`, in UTC |
| `feed` | What the source is called |
| `feedUrl` | Which feed it came from |

An item with no date sorts **last** rather than as *now*, so a feed that omits
dates cannot crowd out the ones that keep them.

`publishedLabel` exists because a merged list shows a date on every row, and a
board has no date formatter to derive one with. It is UTC, because the
formatting happens wherever the runtime is and that is not where the reader is.

Atom entries carry both a publication and an update date, and the publication
date wins: a list sorted by *last touched* reorders itself when a publisher
fixes a typo in something from last week, which is not what a reader looking
for what is new is asking to see.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `feeds` | `array` | `[]` | The subscriptions. Each entry is a URL string, or `{ url, name }` |
| `limit` | `number` | `60` | Most articles to emit, after merging and sorting |
| `timeoutMs` | `number` | `10000` | How long one feed gets to answer |
| `summaryChars` | `number` | `240` | Longest summary kept; `0` drops summaries |
| `fetching` | `boolean` | — | Read-only: whether a round is in flight |

A feed's `name` is what the list shows as the source. Left empty, the feed's own
title is used, and failing that its host.

### Commands

Three configure keys are instructions rather than settings, because a facade
has a field and a button rather than an editor for a whole list:

| Key | What it does |
|---|---|
| `addFeed` | Subscribes to a URL (or `{ url, name }`); a feed already on the list is not added twice |
| `removeFeed` | Unsubscribes the URL given |
| `refresh` | Fetches now — the same work `process` does |

`refresh` exists because a panel is the one caller that cannot use `process`: a
service on a remote runtime has no local instance for its UI to call, so
`configure` is the only verb that reaches it. Injector's `inject` is the same
arrangement for the same reason.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value — it is a trigger, and its content is ignored |
| **Output** | `null` immediately; the article array is pushed through the rest of the pipeline once the feeds answer |

The articles do not exist when `process` returns, so they cannot be returned
from it. Returning `null` stops the synchronous push and the rest of the
pipeline is called with the list when it arrives — the inversion-of-control
path a fetching service takes.

### What it says while it works

| Notification | When |
|---|---|
| `{ fetching: true, sources }` | A round has started |
| `{ fetching: false, fetchedAt, sources, count, error, errors, items }` | It finished |
| `{ feeds }` | The subscription list changed |

`items` is notified but deliberately **not** part of the state a board is saved
with: the articles are a fetch's result rather than a setting, they are large,
and they are stale the moment they are written.

The feed list is announced whenever it changes, not only returned to whoever
changed it — a panel and a facade both render it, and only one of them made the
call.

---

## Reading a feed without a parser

The feed is read by a scanner over the markup rather than by a general XML
parser. That is the honest description of its range: it finds the element
boundaries the three formats use, unwraps CDATA, and decodes the entities that
appear in feed text — including the doubly-escaped ones publishing systems
produce, and HTML that arrives escaped rather than in CDATA. A document that
would need a real parser to read is out of its range, and the answer for one is
a parser, not more regular expressions.

A document with no items reads as **no items**, not as an error: a board shows
that as a feed that said nothing, which is something it can act on.

---

## Typical uses

A reader, with a database behind it:

```
Timer → RSS → Stopper                    (the refresh, which is a read)
        SQL (insert) → SQL (query)       (what a facade's Save button processes)
```

The refresh ends in a [Stopper](./stopper.md) so the article list is notified
and goes no further; without it every refresh would push the whole list into
the insert. See `boards/rss-demo-board.json`.

Watching one feed for something in particular:

```
Timer → RSS → Filter → Telegram Sender
```

Feeding a model what a field is saying today:

```
Injector → RSS → Map → Text Generation
```
