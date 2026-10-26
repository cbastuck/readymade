# Hacker News Reader

Hacker News as an app: the stories on one side, the discussion of the one you
picked on the other.

## What it does

The buttons along the top pick a list — **Top** (the front page), **New**,
**Best** (recent stories past 300 points, newest first), **Ask** and **Show**.
The search field searches every story ever posted, by relevance. A headline
opens the story; a story without a link of its own (an Ask HN, say) opens its
page on Hacker News instead.

**N comments** under a story reads its discussion in the right-hand column:
the post itself where it has text, then every top-level comment, in the order
Hacker News ranks them, with how many replies each one drew. The link under
the title opens the whole thread on Hacker News, which is where the replies
are read.

## How it works

One browser runtime, nothing to install. It holds three small pipelines, one
for each thing the facade asks, each a [sub-service](../services/browser-sub-service.md)
that keeps its result to itself — so opening a discussion does not reload the
list:

1. **Which list** — a [Map](../services/map.md) holding the five lists, each
   with the address and parameters that fetch it, and saying which one is
   picked. The buttons are drawn from it, so the list in force is the one
   highlighted.
2. **Stories** — an [http-client](../services/http.md) asking the search API
   [Algolia hosts for Hacker News](https://hn.algolia.com/api), and three Maps
   that turn each hit into what a row shows: title, site, points, author, age.
   Picking a list configures the client with that list's address and
   parameters and runs the pipeline again.
3. **Discussion** — a thread asked for twice at once, with
   [Tracks](../services/tracks.md) running two clients side by side. Algolia
   sends the whole thread in one document but lists the comments oldest first;
   Hacker News's own API sends the story's comment ids in the order it ranks
   them. The [SQL](../services/sql.md) service puts the two together.

The comments arrive as HTML. A facade's text is plain text, so the SQL
statement cuts the tags out — a recursive query removing one tag per step until
none is left — and turns paragraphs into blank lines. Entities such as `&gt;`
are decoded only afterwards, so a `<` someone typed is never mistaken for a
tag. The statement reads nothing it stores, so the board keeps no database in
the browser.

Both APIs answer any origin, which is what lets the browser call them directly.
Nothing is signed in: the board reads Hacker News and does not post to it.
