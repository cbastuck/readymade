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
the post itself where it has text, then the whole thread. Every reply sits
under the comment it answers, indented one step further; the top-level comments
come in the order Hacker News ranks them, and the replies under each in the
order they were written. A deleted comment keeps its place when it has
replies, so they are not left under the wrong one. The link under the title
opens the thread on Hacker News.

**[–]** beside a comment folds it: its replies go, it shrinks to its first
line, and the next thread moves up — the quick way past a branch that is not
worth reading. **[+N]** says how many replies it hides and opens it again.
**Collapse all** folds the thread down to its top-level comments, each one line,
to open the ones worth reading; **Expand all** puts everything back. What is
folded is remembered per story, so a thread opened again is the way it was
left.

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
   [Tracks](../services/tracks.md) running two requests side by side. The
   facade sends only the story's id; each track makes its own address from it
   with a Map and hands it to its client as `meta.url`, so nothing is
   reconfigured per story. Algolia sends the whole thread in one document but
   lists the comments oldest first; Hacker News's own API sends the story's
   comment ids in the order it ranks them. The [SQL](../services/sql.md)
   service puts the two together.

The comments arrive as HTML. A facade's text is plain text, so the SQL
statement cuts the tags out — a recursive query removing one tag per step until
none is left — and turns paragraphs into blank lines. Entities such as `&gt;`
are decoded only afterwards, so a `<` someone typed is never mistaken for a
tag. The same statement walks the tree of replies depth first, giving each
comment a sort key made of its parent's with its own place appended — so
ordering by it puts every reply under the comment it answers — and an indent
the facade draws as an empty column before the text.

Folding is the one thing the board keeps. Two tables in the browser's SQL
database hold it: one row per comment someone folded or opened, and one per
story collapsed as a whole, which a comment's own row overrides. The comments
query stops walking the tree at a folded comment and counts what it skipped. So
that folding does not fetch the thread again, the thread is put in a
[Hold](../services/hold.md) when it arrives: a fold enters the discussion
pipeline at the statement that records it, and the Hold hands the kept thread
to the queries after it.

Both APIs answer any origin, which is what lets the browser call them directly.
Nothing is signed in: the board reads Hacker News and does not post to it.
