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
| 09 | **Who pays for it**: the offer table and the readiness argument | rewritten from the first commercial drafts (kept in `private-plans/`) |

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

- [x] OpenCode is not named until it is on this branch (below). The
      provider bullet in `Pitch.tsx` already names an OpenCode server, ahead
      of the rebase that brings it. *On the branch since `ios_feature_add`
      merged into `main` (#59).*
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
| **For yourself** | **Health Log** (hero) | browser (`health-log-browser`) | video (`health-log.mp4`, 29 s, *shot 2026-11-06*) | *variant and `.sqlite` export done 2026-11-06* (the SQL service's `export` takes `format: "sqlite"` on both runtimes; the board's button sits first in its pipeline and stops there); keep the not-a-medical-device wording |
| | HN Reader | browser | still (`hacker-news.jpg`) | *done 2026-11-06:* rebased, registered as `hacker-news`, card written, still taken |
| | RSS Radio | video · run it yourself (node, python) | video (`rss-radio.mp4`, 32 s, *shot 2026-11-07*) | *registered and card written 2026-11-06; shot on the lanes 2026-11-07* (see "The shoots") |
| | Live Radio | in the Readymade app | video (`live-radio.mp4`, 31 s, *shot 2026-11-07*) | *registered; shot on hkp-rt 2026-11-07* (see "The shoots") |
| **For your club, team and customers** | **Court Booking** (hero) | browser (`court-booking-browser`) | video: two members, one slot, the second refused | *shot 2026-11-06* (`court-booking.mp4`, 28 s; see "The shoots") |
| | Meeting Poll | browser (`meeting-poll-browser`) | video: deployed, several members answering | *variant done 2026-11-06; shot 2026-11-06* (`meeting-poll.mp4`, 29 s) |
| | **AI Collaboration** (SYN Mail Desk) | video · run it yourself (node, IMAP, SMTP, model) | video | *registered 2026-11-06, the card titled AI Collaboration (the board keeps its name);* shoot |

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
      want). One commercial decision is held back on purpose, and recorded
      in `private-plans/` with the two first markdown drafts, which the deck
      supersedes.
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
      `COMMERCIAL_SLIDES` in `hkp-website/src/pages/Pitch.tsx`, always in the
      deck since `SHOW_COMMERCIAL_DRAFT` was removed (2026-11-08).
- [x] Bring the commercial-licensing plan up to the Oct 19 decisions. It is
      kept outside this repository since 2026-11-08: it holds the draft
      licence agreement, which awaits legal review.
      *Done 2026-11-06:* the offer table and Partner's three deliveries
      (embed, host, Partner on Cloud later), AGPL re-vetted and kept, the
      development commitment held back until traction.
- [x] Get `hkp-website/astro/pages/pricing.astro` into shape; the pitch
      covers the offer, the page covers the detail. *Done 2026-11-06:* laid out by the offer table — Community (AGPL,
      builds at €4.99), Cloud (not open yet, no price), Partner
      (Embedded and Hosted, the revenue-share option, Partner on Cloud later);
      the development commitment removed. The table is drawn like slide 09's
      and is the page's navigation: a chosen cell (kept in the address,
      `/pricing/#cloud`) shows only its own text. *Made public 2026-11-08:*
      the draft flag is gone; Partner is "talk to us" with indicative figures,
      the not-yet-open offers ask early adopters to say hello
      (`TODO-EARLY-ADOPTERS.md`), and Community's prices say no VAT is
      charged (§19 UStG). Partner's carry no tax line: what applies there is
      a commercial question, kept in `private-plans/`.
- [x] Keep to the vocabulary rule: no *fund*, *invest*, *shares*, *stake*,
      *equity*, *returns*. And no "there is nothing to host" while Cloud is
      not an offer yet. *Checked 2026-11-06:* `COMMERCIAL_SLIDES` and
      `pricing.astro` are clean. "A share of revenue" (the licence's
      pay-as-you-grow option) is a royalty term and stays. Embed it's "needs no
      server at all" is about a browser + hkp-rt board, not about Cloud. The
      only hits were in the two superseded markdown drafts, since moved to
      `private-plans/`. Re-check whenever slide 07, 09 or the gallery adds
      copy.

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
      `syn-mail-desk`, `health-log-browser`, `rss-radio`; `hn-reader` became
      `hacker-news`, after its board's file) before
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
- [x] Spotlight content for each pick as its board lands: the planned slugs
      above. *Done 2026-11-06:* every slug on both shelves is registered and
      has its card, so no shelf shows a "not registered yet" card. The video
      picks (RSS Radio, AI Collaboration) have no video yet:
      `demoShelves.test.ts` now asks a video pick for `runItYourself` always
      and for a video only once it has `media`, so in production such a card
      is text and the board to run yourself. **The shoots have to land before
      `SHOW_PITCH_GALLERY` goes on.** Both are compositions of units, and a
      demo opens at no URL, so `demoRegistry.ts` carries their unit documents
      (`findDemoUnits`) and the playground links from them on `?demo=`, as it
      does for a restored draft; the shelf test checks every unit a composed
      pick names is carried. Opening either in the browser is not tried yet. (Shared Costs had its card done 2026-11-06, then moved to the AI
      slide; a newer render of its video goes under the same path.) Swap a planned slug for the real one if the board's name ends
      up different.

---

## The shoots

A gallery video is made the way the Golden Path video is
(`TODO-GOLDEN-PATH-VIDEO.md`, "Rules for the shoot"): real pixels from a take
in `e2e/film/<slug>.film.ts`, framed by a Remotion cut in
`hkp-website/media/readymade-explainer/remotion/videos/<slug>/`. What differs:

- **The app in use, not being built.** A take starts from the board the
  repository ships, with no assistant beats; building belongs to slide 07.
- **Short and captioned.** About 30 s. The gallery plays it muted beside the
  card, so the captions carry it. It is narrated anyway, for the enlarged view
  with controls. Captions are the narration's words, as in every explainer.
- **Shipped as** `hkp-website/public/images/pitch/<slug>.mp4` (the narrated
  render) and `<slug>.jpg` (a frame of the beat that proves the outcome), named
  in the catalog entry's `media`.

```sh
cd e2e && npm run film -- <slug>               # the take: stills + shots.json
cd hkp-website/media/readymade-explainer
python3 tools/generate.py remotion/videos/<slug>   # narration, storyboard, video
```

The render's mux needs `ffmpeg` on the PATH (`/opt/homebrew/bin`), and the
take needs `npm ci` in hkp-node. **One take per run:** the server's data is
disposable per start, not per take, so two takes that deploy as the same
person to the same coordinator collide (the second finds Sam already listed).

- [x] **Court Booking.** *Shot 2026-11-06* (`court-booking.film.ts`, cut
      `CourtBooking`): the timetable; Ana takes tomorrow at six and the rest of
      her day closes; she and Sam confirm one hour at once, one gets it, the
      other is told. Its booking and race beats moved into `e2e/film/court.ts`,
      shared with the Golden Path take, which still passes on its tape.
- [x] **HN Reader.** *Still taken 2026-11-06* (`hacker-news.film.ts`): the
      front page beside the busiest of its first eight stories' thread, the
      first branch with replies folded. A take never reaches the internet, so
      Hacker News is a recording: `httpTape.ts` records a board's calls to the
      origins named once (`FILM_HTTP=record FILM_STORY=hacker-news`) and replays
      them by address, with the page's clock set to the recording's time so
      "9 hours ago" stays true. Real stories, usernames and comments (decided
      2026-11-06); the recorded thread is whatever was busiest then — re-record
      for another.
- [x] **Meeting Poll.** *Shot 2026-11-06* (`meeting-poll.film.ts`, cut
      `MeetingPoll`): Sam calls a team dinner and puts up three evenings; Ana
      and Ben answer on their phones; Sam sees who can make which and the best
      so far; he closes the poll, and a tap on Ana's stale page is refused by
      the schema's trigger ("the poll is closed"). `cast` now has Ben,
      `deployAndShare` lists further members, and `memberOpensIt` opens the
      board on anybody's phone. The take fails on any page error on Ana's
      phone, because the first take found one: a refusal on an attached board
      threw in `raiseError` (the coordinator's runtime scope had no
      `services`), showing a TypeError toast over the reason. Fixed in
      `bridgeRuntimeApi.ts`, with a test.
- [x] **Health Log.** *Shot 2026-11-06* (`health-log.film.ts`, cut
      `HealthLog`): the browser version, nobody signed in. A glucose value
      logged; Generate fake data; Trends with a day's journal in the hovered
      point's tooltip; Export as .sqlite, asserted to be an SQLite file. The
      export changes nothing on screen, so the cut labels it with the file the
      take downloaded (name and size, from `shots.json`). Its narration closes
      on the card's wording: a record of what you enter, not a medical device.
      The desktop frame's title is now the manifest's `desktopTitle` (default
      "Readymade · Sam"), since this screen is nobody's.
- [ ] One take failed once before the board opened with `SyntaxError:
      Unexpected end of JSON input`, and passed unchanged on the next run —
      likely the identities' keys file read while the JWKS server writes it.
      Not investigated.
- [x] **Live Radio.** *Shot 2026-11-07* (`live-radio.film.ts`, cut
      `LiveRadio`), a Playwright take after all: the board only names
      `embedded`, so the film config starts a standalone hkp-rt where one is
      built and keeps it under that name. The microphone is BlackHole 2ch (the
      take points `core-input` at it and the encoder at two channels), and
      `say -a "BlackHole 2ch" -v Daniel` speaks one line into it. Start; a
      phone-sized page opens the player and taps Listen; the station counts
      one; and what the stream carried while the voice spoke is recorded, then
      decoded in the phone's browser and measured — so a take with the
      microphone refused (macOS asks once) fails instead of filming silence.
      The cut plays that recording through `clips`. The scan itself is not
      filmed: a light on the code, then the phone.
  - [x] On a standalone hkp-rt the facade's "Stream (VLC)" stayed empty: a
        mounted endpoint's "online" notification carried no `streamUrl`, and
        its state appended the path to a mount address that has no trailing
        slash (`…/hosted/<id>live.mp3`). Joined now, in both places
        (`http_stream.test.cpp`).
  - [ ] The addresses on screen are `127.0.0.1:18200/hosted/…`, where the app
        shows its LAN address and port 8890. Legible only in the wide shots.
- [ ] **AI Collaboration.** The model is called from hkp-node, not the browser,
      so the assistant tape does not reach it. Needs a stand-in IMAP/SMTP
      server and a recorded or local model before a take can run.
- [x] **RSS Radio.** *Shot 2026-11-07* (`rss-radio.film.ts`, cut
      `RssRadio`), on the five lanes (`TODO-RADIO-LANES.md`): BBC World
      unsubscribed first (a pitch reads no world news aloud), three Hacker
      News articles dragged onto the reading list, each briefed by the model,
      voiced on hkp-python and on air with a player, in about 90 s. The take
      keeps the episode with the longest brief (a page the editor could not
      read is briefed from its title), and the cut plays four seconds of it —
      the radio's own voice — through `clips` in `video.json`, a field
      `tools/generate.py` gained for it. A failed card ends the take with its
      reason. The model key is the Board Assist entry of the vault
      (`readymade.assist.anthropic`); `anthropic.key` there is the old,
      refused one.
  - [x] Unsubscribing during the board's first fetch brought the feed's
        articles back: the older round finished last and overwrote the newer
        list. The RSS service now drops a round a newer one has overtaken
        (`rss.test.ts`).
  - [ ] Card times are UTC under a local-looking label ("On air since
        18:41" at 19:41 Berlin): the tables stamp `datetime('now')`. Say UTC,
        or convert for display.
  - *First real run 2026-11-07*, a rehearsal: the composition opened from `?demo=rss-radio`
      against the film's hkp-node and a new hkp-python beside it (loopback, no
      sign-in, the real home for the cached Kokoro model), real feeds, the
      model key as the secret `anthropic.key` in the page's vault (read from
      `ANTHROPIC_API_KEY`, consent answered, no trace written). Three
      articles saved reach the editor; every runtime's service states are
      dumped to `test-results/film/rss-radio/states.json`. What it found:
  - [x] A composed demo opened in the Readymade app lost its units: App's
        `?demo=`, the desktop start page and the mobile start screen handed
        over the board alone (and the start page's history entries dropped the
        units they were kept with). Fixed in `meander/frontend/src`.
  - [x] The radio's feed and playlist, and the editor's desk and feed, failed
        with "no such table" until the first article was claimed — only the
        claim declared the schema. Each reading service now declares it too;
        tests in `rss-radio-board.test.ts` and `rss-radio-editor-board.test.ts`.
  - [x] The reader's "As a feed" said "not published yet" while the feed was
        published: a nested service on a remote runtime got no state until it
        reported, and a mount's address is never reported. `findService` now
        reads it from the scope's own state, by uuid (`scopedAddress.test.ts`).
  - [x] The model key given was refused by Anthropic itself (401 on
        `/v1/models`). *Shot with a working key 2026-11-07.*
  - [ ] `apiKey` defaults to `{{secret.anthropic.key}}`, and hkp-node fails a
        named secret it cannot find before it looks at `ANTHROPIC_API_KEY` —
        the fallback the board's docs promise does not happen. Decide: fall
        back for the `anthropic` backend, or change the docs.
  - [ ] Then: the voice and the library for real, and the story.

---

## Branches

Read from `hacker_news_board` and `ios_feature_add`, never written to.

**HN Reader.** *Done 2026-11-06.* The root `commercial_case` is rebased onto
`hacker_news_board` (the pre-rebase head is kept as
`commercial_case-pre-hn-rebase`). `boardServices.ts` conflicted: both sides
added a function in the same place, and both were kept. `http.md` merged on
its own. Typecheck and the frontend suite pass. The five commits that were
already on `origin/commercial_case` are rewritten, so the next push is a
force-push.

`hacker_news_board` and the root `commercial_case` both start at
`b9174c6d`, and the HN branch changes only root files: submodule pointers are
identical on both. So the **root** `commercial_case` is rebased onto it, and
**hkp-node's `commercial_case` needs no rebase** for this. Expect overlaps in
`docs/content/services/http.md` and `hkp-frontend/src/facade/boardServices.ts`.

**OpenCode.** `b2ec508a` builds on M6 (`9042e921`), which moved Board Assist
into `useBoardAssist.ts` and added a token store, neither of which exists
here. *Decided 2026-11-06:* **`ios_feature_add` merges into `main` first**,
and `commercial_case` is rebased onto it, instead of porting OpenCode here.
A port was built and dropped the same day: a trial merge showed the conflict
that costs work is the same in either order, and the original is the fuller
version (token store and vault sync, drafts kept on `pagehide`, the mobile
Assist page). `ios_feature_add` sits on the current `main` and merges
without conflicts.

The rebase, once it has merged:
- [x] carry `e145fcab`'s Board Assist changes (usage counting, the review
      summary) from `BoardAssistPanel.tsx` into `useBoardAssist.ts`; the
      other conflicts are `BoardAssistPreview.tsx`, `ServiceFrame.tsx` and
      `plans/README.md`;
- [ ] have the OpenCode turn report usage like the other providers: one
      request, no tokens, since its stateless API returns none. *Today it
      reports none at all (`usage: undefined` in `useBoardAssist.ts`), so an
      OpenCode turn is missing from the conversation's request count;*
- [x] typecheck and the frontend suite. *Pass, 2026-11-08.*

---

## Milestones

1. **Mergeable `commercial_case`.**
   - root rebased onto `hacker_news_board` (done); `ios_feature_add` merged
     into `main` and `commercial_case` rebased onto it (brings OpenCode)
   - gallery component, with the browser and app picks registered
   - browser variants of Meeting Poll and Health Log (done; the Health Log export is not)
   - slide 07 with the existing videos
   - commercial slides rewritten in the deck; pricing page public (the
     draft flag removed 2026-11-08)
2. **The shoots.**
   - Court Booking with two members, Live Radio with a phone, Meeting Poll,
     Health Log, AI Collaboration; RSS Radio last, once its editor unit works
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
