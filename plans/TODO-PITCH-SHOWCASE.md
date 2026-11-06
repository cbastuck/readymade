# Pitch showcase: the demos, the AI slide and the commercial track

Drafted 2026-11-06 on `commercial_case`. Commercial slides in the deck; the rest not built.

The pitch explains *how* Readymade works (services, composition, blocks,
distribution, the facade) and then said "Open a board. Use it. Then look under
the hood." with a single link (now headed "Demo time.", with the subline
"Check out some showcases. Then open their boards and look under the hood.":
see an app first, then its board). This plan replaces that link with a gallery of
starting points, adds a slide for building with AI, and adds the commercial
track. Together they have to make one thing obvious to a visitor: what
Readymade is, and **why they want it**.

The scope of Readymade is wide. Show that range without overwhelming anyone:
visitors should count **shelves**, not demos.

---

## Decided

- **The gallery lives in the pitch, on the Try-it slide.** No separate demos
  page. The slide shows three rows, each chosen like the pricing page's offer
  table: the shelves; once a shelf is chosen, its boards by name; and the
  chosen board in full, its video or still beside its description and how to
  open it. Choosing a shelf chooses its hero (changed 2026-11-06 from heroes
  on show with a shelf expanding in place).
- **One source for the picks.** The cards are `DEMO_CATALOG` entries
  (`hkp-frontend/src/demoCatalog.ts`) with optional spotlight fields. The
  start page and the board hub keep reading the same entries.
- **Every card says how it opens**, and only one way leads:
  - **In your browser:** one click, nothing to install.
  - **In the Readymade app:** needs the desktop or mobile app (`remote: embedded`).
  - **Video:** anything that needs hkp-node or hkp-python. The demo URL is
    still given, under "run it yourself", for people who run their own runtime
    servers.
- **No public demos on node1 in this plan.** Booking a court or answering a
  poll as an anonymous visitor needs a guest identity on a deployed board.
  Today a deployed board admits only its owner and verified members, and
  without login there is no caller. That is its own plan. Until it lands,
  Court Booking and Meeting Poll open as browser versions, and a video shows
  them deployed with several members.
- **Building with AI gets its own slide**, carrying the two arguments of the
  Golden Path video as a nudge, not a claim (below).
- **Browser versions show what an app does; a deployed board makes it usable.**
  Every SQL demo that can run in the browser gets a browser version: Court
  Booking has one, Meeting Poll and Health Log get one. In the browser the
  data lives in this browser, on this device, for one person. That is enough
  to try the app and not enough to run a club on. Cards and slides say so
  plainly, and say what changes once the board is deployed: one database,
  shared by its members, kept while nobody is watching. This is also the
  bridge to the Cloud offer.
- **The commercial track is part of this deck**, right after Try it, and
  built in this round. It follows the Oct 19 frame: Cloud and Partner, the
  offer table *for whom × who runs it*, the licence as the contract inside
  Partner, the builds at a fixed price (pay what you want was dropped on
  2026-11-06). The Oct 11 licence-first drafts are
  rewritten, not appended.
- **HN Reader is in** and comes from `hacker_news_board`.
- **OpenCode is in**, ported from `ios_feature_add`. Both source branches stay
  untouched; they are only read from.

---

## The deck

| # | Slide | State |
| --- | --- | --- |
| 01–06 | Idea, Services, Composition, Blocks, Distributed composition, From board to app | exist; copy pass (outcome before concept) |
| 07 | **Building with AI**: *Describe the app. Review what is new.* | drafted, behind `SHOW_PITCH_AI_SLIDE` (development only) |
| 08 | **Try it**: *Demo time.*, the gallery | rewritten |
| 09 | **Who pays for it**: the offer table and the readiness argument | rewritten from `hkp-website/readymade-pitch-commercial-slides.md` |

Slides are numbered by position (`SLIDES` in `Pitch.tsx`), so a slide behind a
flag never leaves a gap in the numbering.

### 07 — Building with AI

Board Assist builds the board from a description, out of services and blocks
you can name, inspect and change. Bring your own key: Anthropic, OpenAI, any
OpenAI-compatible endpoint (including a model on your own machine), OpenCode.

The two arguments are **nudged, not claimed**: no "x times fewer", no
comparison with another stack, no "reviewed". The copy says why the effect
follows and leaves the visitor to draw the conclusion. A real comparison comes
later, in its own round.

1. **Fewer output tokens.** The assistant composes services that exist instead
   of writing them, so what it produces is a board, not an implementation, and
   a later change edits that board instead of rewriting code.
2. **Less to review.** The services exist and are in use in other boards, so
   what is left to read is what the assistant added.

The Shared Costs run's own figures (201,393 tokens in 5 requests, about $0.99;
138 lines to review, six new SQL statements) may appear as what happened in
that run, never framed as a saving. The rules in `TODO-GOLDEN-PATH-VIDEO.md`
("No number that was not measured") apply here too.

Media: the Shared Costs video (exists). Golden Path is linked from the slide.
Add a still of Board Assist showing the provider choice.

*Drafted 2026-11-06:* the AI slide is in `BUILD_SLIDES`, before Try it, behind
`SHOW_PITCH_AI_SLIDE`. Its paragraph carries both nudges as reasons, not
claims: the assistant composes services that exist, so what it writes is a
board; before you apply, it says what is new and what the rest is built from.
Bullets: your model and key (Anthropic, any OpenAI-compatible endpoint, a
local model); the MCP knowledge server (`readymade-mcp`: contracts, compatible
services, examples, `validate_board`, usable by any MCP client); the Shared
Costs run (five requests, about $0.99, 11,504 tokens written, 138 lines to
review). The video links to the Board Assist concept page.

- [ ] OpenCode is not named until it is ported (below).
- [x] The Shared Costs video is this slide's, not the gallery's. *Decided
      2026-11-06:* it shows an app being built, so it belongs with building
      with AI; the Shared Costs pick left the gallery's shelf. Its catalog
      entry, registration and docs page stay, so the start page still lists
      it and "Run it yourself" still works.

### 08 — Try it

Two shelves, each named after what you'd build, not the feature it shows.
(Three until 2026-11-06: *Live, sound and motion* was dropped, and its Live
Radio moved to *For yourself*. Nested Rhythm + Timeline is no longer a pick:
slide 03 already links Nested Rhythm.)
Each shelf has one hero that opens in the browser. The shelf titles show the
range; the cards behind them show depth.

| Shelf | Pick | Opens | Media | Work |
| --- | --- | --- | --- | --- |
| **For yourself** | **Health Log** (hero) | browser (new variant) | still or short video | browser-SQL variant; export the database as a `.sqlite` file; keep the not-a-medical-device wording |
| | HN Reader | browser | still | rebase onto `hacker_news_board` (below), register |
| | RSS Radio | video · run it yourself (node, python) | collage exists (`reading-radio-*.png`); video | finish the editor unit drafted in `6096cec8`, shoot |
| | Live Radio | in the Readymade app | video: a phone scans the QR code and plays the mic | register, shoot |
| **For your club, team and customers** | **Court Booking** (hero) | browser (`court-booking-browser`) | video: two members, one slot, the second refused | shoot |
| | Meeting Poll | browser (new variant) | video: deployed, several members answering | browser-SQL variant like Court Booking's; shoot |
| | **AI Collaboration** (SYN Mail Desk) | video · run it yourself (node, IMAP, SMTP, model) | video | retitle the board for visitors; shoot |

Every pick needs the same checklist: board polished · slug registered ·
**outcome line** (what you get, e.g. "Your club's courts, bookable from a
phone, never double-booked") · **under the hood** line (the concept it shows,
linked to its docs page) · what to expect · media · `docs/content/boards/`
page. A browser version's card also says where its data lives ("in this
browser, for you") and what deploying the board changes.

### 09 — Who pays for it

- [x] Rewrite the commercial track around the offer table (*yourself / your
      customers* × *you run it / we run it*). Cloud and Partner are where the
      money comes from; the commercial licence is the contract under Partner;
      the builds sit inside Community (now a fixed €4.99, not pay what you
      want). The development commitment (a published share of licence revenue
      spent on Readymade) is left out on purpose: not stated before there is
      traction. The two markdown drafts in `hkp-website/` are superseded by
      the deck.
- [x] **One slide, and the argument is readiness.** *Decided 2026-11-06:* the
      offer table already says what each slide after it said, so Community,
      Cloud, Partner, Embed it and the licence are gone; the licence terms
      live on the pricing page, which the slide links. What convinces someone
      to pay is not how a board works inside (Court Booking's club rules as
      database indexes are not a selling point: the first question is "can I
      have my own rules", and making a board yours is the whole idea). It is
      that a board made in Readymade is ready the moment it works: deployed as
      it is, nothing rewritten, and Cloud keeps it running. Headline *When the
      board is ready, so is the app.*, the old headline as its subline.
      `COMMERCIAL_SLIDES` in `hkp-website/src/pages/Pitch.tsx`, shown with
      `SHOW_COMMERCIAL_DRAFT`.
- [x] Bring `TODO-COMMERCIAL-LICENSING.md` up to the Oct 19 decisions.
      *Done 2026-11-06:* the offer table and Partner's three deliveries
      (embed, host, Partner on Cloud later), AGPL re-vetted and kept, the
      development commitment held back until traction.
- [x] Get `hkp-website/astro/pages/pricing.astro` into shape, still behind
      `SHOW_COMMERCIAL_DRAFT`; the pitch covers the offer, the page covers the
      detail. *Done 2026-11-06:* laid out by the offer table — Community (AGPL,
      builds at €4.99), Cloud (not open yet, no price), Partner
      (Embedded and Hosted, the revenue-share option, Partner on Cloud later);
      the development commitment removed. The table is drawn like slide 09's
      and is the page's navigation: a chosen cell (kept in the address,
      `/pricing/#cloud`) shows only its own text. Figures still placeholders.
- [x] Keep to the vocabulary rule: no *fund*, *invest*, *shares*, *stake*,
      *equity*, *returns*. And no "there is nothing to host" while Cloud is
      not an offer yet. *Checked 2026-11-06:* `COMMERCIAL_SLIDES` and
      `pricing.astro` are clean. "A share of revenue" (the licence's
      pay-as-you-grow option) is a royalty term and stays. Embed it's "needs no
      server at all" is about a browser + hkp-rt board, not about Cloud. The
      only hits were in the two superseded markdown drafts (the
      development-commitment slide), which now say at the top that they are
      superseded. Re-check whenever slide 07, 09 or the gallery adds copy.

---

## The gallery component

- [x] Spotlight fields on `DemoCatalogEntry`, all optional so existing entries
      are unaffected: `outcome`, `expect`, `underTheHood` (text + docs href),
      `opens` (`browser | app | video`), `runItYourself` (href + what it needs),
      `media` (video + poster, or image), `members` (slugs, for a group pick).
      *Done 2026-11-06,* plus `deployed`: what deploying a browser version
      changes; the card says its data lives in this browser, for you.
- [x] A shelf list (id, title, one line, hero slug, pick slugs) beside the
      catalog. *Done:* `DEMO_SHELVES` in `hkp-frontend/src/demoShelves.ts`,
      naming the planned slugs (`meeting-poll-browser`,
      `syn-mail-desk`, `health-log-browser`, `hn-reader`, `rss-radio`) before
      their boards exist. `resolveShelf` leaves out what the catalog lacks and
      falls back to the first pick that exists while a hero does not.
      `demoShelves.test.ts` checks that heroes open in the browser, that every
      shelved pick that exists has `opens`, `outcome` and `underTheHood`, that
      a video pick has a video and `runItYourself`, and that every pick is
      registered.
- [x] The gallery on the Try-it slide: shelves visible, heroes clickable, a
      shelf expanding in place. Phone width included. *Done:*
      `hkp-website/src/pages/PitchGallery.tsx`. Three rows chosen like the
      pricing page's offer table, the chosen cell black: the shelves (a
      dashed hint until one is chosen), the shelf's boards by name and how
      each opens, and the chosen board in full. Choosing a shelf chooses its
      hero. The board's video plays muted beside its text and enlarges into
      the slide's video modal; a still enlarges too. The video path has no
      board to show it yet, so it is untested in the browser. The choice is
      not kept in the address, unlike pricing. Behind
      `SHOW_PITCH_GALLERY` (development only). In development, unregistered
      slugs show as dashed "not registered yet" cards, and a missing hero
      shows as missing instead of the first pick standing in for it. In
      production the slide keeps its single link until the flag flips. The
      production build is unchanged: the gallery is dropped and no board
      JSON reaches the main chunk. Check that again when the flag goes
      on, since `demoCatalog.ts` imports the registry for `demoBoardFor`.
- [x] Built first with placeholder media so it doesn't wait on the shoots.
      While drafting, a dashed "video or still to come" box stands in; in
      production a board without `media` shows its text at full width.
- [x] Registered `timeline` and `live-radio` (the app pick), with catalog
      entries. `timeline` stays registered for the start page after its
      shelf was dropped.
- [ ] Spotlight content for each pick as its board lands: the planned slugs
      above. (Shared Costs had its card done 2026-11-06, then moved to the AI
      slide; a newer render of its video goes under the same path.) Swap a planned slug for the real one if the board's name ends
      up different.

---

## Branches

Read from `hacker_news_board` and `ios_feature_add`, never written to.

**HN Reader.** `hacker_news_board` and the root `commercial_case` both start at
`b9174c6d`, and the HN branch changes only root files: submodule pointers are
identical on both. So the **root** `commercial_case` is rebased onto it, and
**hkp-node's `commercial_case` needs no rebase** for this. Expect overlaps in
`docs/content/services/http.md` and `hkp-frontend/src/facade/boardServices.ts`.

**OpenCode.** `b2ec508a` builds on M6 (`9042e921`), which moved Board Assist
into `useBoardAssist.ts` and added a token store, neither of which exists
here. So it is a **port, not a cherry-pick**:
- [ ] take `openCode.ts` and `openCode.test.ts` as they are (they import only
      `documentation`, `knowledge`, `openAICompatible`, `scope` and `types`,
      all present here);
- [ ] redo the provider wiring against this branch's `settings.ts`,
      `AssistSettings.tsx` and `BoardAssistPanel.tsx`;
- [ ] leave out `MobileAssistPage.tsx`, which comes from M6.

When `ios_feature_add` merges later, its version of those files wins.

---

## Milestones

1. **Mergeable `commercial_case`.**
   - root rebased onto `hacker_news_board`; OpenCode ported
   - gallery component, with the browser and app picks registered
   - browser variants of Meeting Poll and Health Log
   - slide 07 with the existing videos
   - commercial slides rewritten in the deck; pricing page behind its flag
2. **The shoots.**
   - Court Booking with two members, Live Radio with a phone, Meeting Poll,
     Health Log, AI Collaboration, RSS Radio
   - the Health Log export, if it didn't make 1
3. **Public demos** (separate plan): a guest role on deployed boards on
   node1, so Court Booking and Meeting Poll can be used, not just watched.

---

## Open questions

- [ ] Partner on Cloud (decided 2026-11-06 as a use case, built later): we
      run the runtimes a Partner sells to their customers. That makes us the
      host of content someone else provides, so it needs terms of its own
      (acceptable use, who answers a takedown notice, who the customers'
      data belongs to) before it is offered. The deck names it as coming
      with Cloud, not as available.

- [ ] Later round: a real comparison (the Shared Costs app built on an
      ordinary stack with an assistant), which would allow a measured claim
      in place of the nudge.
