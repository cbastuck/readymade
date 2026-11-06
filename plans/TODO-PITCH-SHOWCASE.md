# Pitch showcase: the demos, the AI slide and the commercial track

Drafted 2026-11-06 on `commercial_case`. Commercial slides in the deck; the rest not built.

The pitch explains *how* Readymade works (services, composition, blocks,
distribution, the facade) and then says "Open a board. Use it. Then look under
the hood." with a single link. This plan replaces that link with a gallery of
starting points, adds a slide for building with AI, and adds the commercial
track. Together they have to make one thing obvious to a visitor: what
Readymade is, and **why they want it**.

The scope of Readymade is wide. Show that range without overwhelming anyone:
visitors should count **shelves**, not demos.

---

## Decided

- **The gallery lives in the pitch, on the Try-it slide.** No separate demos
  page. The slide shows the shelves; opening one reveals the rest of its picks
  in place (the same expand pattern the slide already uses for videos).
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
| 07 | **Building with AI**: *Describe the app. Review services, not diffs.* | new |
| 08 | **Try it**: the gallery | rewritten |
| 09+ | Commercial track, in this deck | rewritten from `hkp-website/readymade-pitch-commercial-slides.md` |

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

### 08 — Try it

Three shelves, each named after what you'd build, not the feature it shows.
Each shelf has one hero that opens in the browser. The shelf titles show the
range; the cards behind them show depth.

| Shelf | Pick | Opens | Media | Work |
| --- | --- | --- | --- | --- |
| **For your club, team and customers** | **Court Booking** (hero) | browser (`court-booking-browser`) | video: two members, one slot, the second refused | shoot |
| | Meeting Poll | browser (new variant) | video: deployed, several members answering | browser-SQL variant like Court Booking's; shoot |
| | Shared Costs | video · run it yourself | video exists | move `e2e/film/boards/shared-costs.json` into `boards/`, register, docs page |
| | **AI Collaboration** (SYN Mail Desk) | video · run it yourself (node, IMAP, SMTP, model) | video | retitle the board for visitors; shoot |
| **For yourself** | **Health Log** (hero) | browser (new variant) | still or short video | browser-SQL variant; export the database as a `.sqlite` file; keep the not-a-medical-device wording |
| | HN Reader | browser | still | rebase onto `hacker_news_board` (below), register |
| | RSS Radio | video · run it yourself (node, python) | collage exists (`reading-radio-*.png`); video | finish the editor unit drafted in `6096cec8`, shoot |
| **Live, sound and motion** | **Nested Rhythm + Timeline** (hero, a group) | browser | nesting video exists | register `timeline` |
| | Live Radio | in the Readymade app | video: a phone scans the QR code and plays the mic | register, shoot |

Every pick needs the same checklist: board polished · slug registered ·
**outcome line** (what you get, e.g. "Your club's courts, bookable from a
phone, never double-booked") · **under the hood** line (the concept it shows,
linked to its docs page) · what to expect · media · `docs/content/boards/`
page. A browser version's card also says where its data lives ("in this
browser, for you") and what deploying the board changes.

### 09+ — Commercial track

- [x] Rewrite the slides around the offer table (*yourself / your customers* ×
      *you run it / we run it*). Cloud and Partner are where the money comes
      from; the commercial licence is the contract under Partner;
      the builds sit inside Community (now a fixed €4.99, not pay what you
      want). *Done 2026-11-06:* `COMMERCIAL_SLIDES` in
      `hkp-website/src/pages/Pitch.tsx`, after Try it and shown only with
      `SHOW_COMMERCIAL_DRAFT` — the offer table (`OfferTable`), then
      Community, Cloud (badged *not open yet*), Partner (Court Booking),
      Embed it (prototype to app: the board and its hkp-rt go into your
      own app), the licence. Labels run 08–13 for now; renumber when 07 lands. The development commitment
      (a published share of licence revenue spent on Readymade) is left out
      on purpose: not stated before there is traction. The
      two markdown drafts in `hkp-website/` are superseded by the deck.
- [ ] Refer back to the numbers on 07 instead of repeating the AI argument.
- [x] Court Booking stays the worked example (it already is in slide 02 of the
      draft). *Holds:* it is the Partner slide's example and its link.
- [x] Bring `TODO-COMMERCIAL-LICENSING.md` up to the Oct 19 decisions.
      *Done 2026-11-06:* the offer table and Partner's three deliveries
      (embed, host, Partner on Cloud later), AGPL re-vetted and kept, the
      development commitment held back until traction.
- [x] Get `hkp-website/astro/pages/pricing.astro` into shape, still behind
      `SHOW_COMMERCIAL_DRAFT`; the pitch covers the offer, the page covers the
      detail. *Done 2026-11-06:* laid out by the offer table — Community (AGPL,
      builds at €4.99), Cloud (not open yet, no price), Partner
      (Embedded and Hosted, the revenue-share option, Partner on Cloud later);
      the development commitment removed. The table is drawn like slide 08's
      and is the page's navigation: a chosen cell (kept in the address,
      `/pricing/#cloud`) shows only its own text. Figures still placeholders.
- [ ] Keep to the vocabulary rule: no *fund*, *invest*, *shares*, *stake*,
      *equity*, *returns*. And no "there is nothing to host" while Cloud is
      not an offer yet.

---

## The gallery component

- [ ] Spotlight fields on `DemoCatalogEntry`, all optional so existing entries
      are unaffected: `outcome`, `expect`, `underTheHood` (text + docs href),
      `opens` (`browser | app | video`), `runItYourself` (href + what it needs),
      `media` (video + poster, or image), `members` (slugs, for a group pick).
- [ ] A shelf list (id, title, one line, hero slug, pick slugs) beside the
      catalog.
- [ ] The gallery on the Try-it slide: shelves visible, heroes clickable, a
      shelf expanding in place. Phone width included.
- [ ] Built first with placeholder media so it doesn't wait on the shoots.

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
