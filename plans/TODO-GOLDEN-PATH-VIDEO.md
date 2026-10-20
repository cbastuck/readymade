# The golden-path video: from a sentence to a member's phone

Planned 2026-10-20. **Preliminary work done 2026-10-20; the real run recorded
the same day** (`e2e/film/tapes/golden-path.json`, Claude Opus 5.5) and the take
passed on it end to end. Beats 2–3 are told as what the run did (script v2).
**First cut rendered 2026-10-20** (`readymade-golden-path-remotion-narrated.mp4`,
75 s); next: its review (phase 4's gate).

This plan is a story first and a work list second: every fix or addition
below exists because a beat of the story needs it, and is named by that beat.
When the two disagree, the beat changes before the footage does.

Companions: `TODO-BOARD-MEMBERS.md` (its open two-person pass is beats 4–6 —
now run, by machine), `TODO-E2E.md` milestone 4 (the authenticated harness built
here is its first item), `hkp-website/media/readymade-explainer/tools/README.md`
(the generator the video is rendered with).

---

## Why this video

It answers the question every visitor has and nobody on the site answers yet:
*why build this with Readymade, and not have Claude Code write it on a normal
stack?* Two arguments, shown rather than said:

1. **Legibility.** The service is the one unit you build with, review, name,
   observe and deploy — deployment included. A custom build has no borders a
   non-technical owner can see. You review what you added; the blocks are
   already in use elsewhere.
2. **Token economy.** The assistant writes a board, not an implementation. Every
   change over the app's life is a small edit to a document, not a session that
   reads and rewrites a codebase. The fewer tokens produced, the more value.

It also shows, without saying so, the two offers the commercial plan expects to
earn from: a board someone else runs for you (Cloud) and a board you run for
your customers (Partner).

## Rules for the shoot

1. **Real pixels.** Every interface on screen is captured from the running app.
   Remotion adds camera moves, highlights, labels, a phone frame and captions —
   it never redraws a UI.
2. **No number that was not measured.** The token count and price are the real
   run's `usage`, summed over every request of the conversation. A take on a
   hand-written tape records no figures at all (`synthetic` in the tape). No
   comparison figure appears unless the comparison was actually run.
3. **Narration leads.** Captions are the narration's words at the narration's
   time, as in the earlier explainers; wording changes in the manifest, not in
   the layout.
4. **Claims the narration may not make** until they are true:
   - that a non-coder can review the SQL — the statements are the code you review;
   - that there is nothing to host — Cloud is not an offer yet;
   - that the member is sent an email — the coordinator sends none; the owner
     adds an address and passes on the link;
   - any duration ("in five minutes") that was not timed.
5. **A beat that cannot be filmed truthfully is rewritten**, not faked.

---

## The story (script v2)

About 95 seconds. Names are fictional and addresses are `club.example`: the
owner is **Sam**, the member **Ana**. Every figure is the recorded run's, as
`shots.json` holds it.

| # | Narration | Picture (shot ids) | Proves |
| --- | --- | --- | --- |
| 0 | "A booking app for three tennis courts. From one sentence to a member's phone." | The finished calendar on a phone (`5-booked`) | the promise |
| 1 | "Describe what your club needs. Three courts, hourly slots, one hour per member a day." | Sam types into the board assistant, empty board behind (`1-describe`) | AI-authored |
| 2 | "The assistant finds the club board Readymade already ships and makes it yours. The whole conversation took 35,694 tokens — about 21 cents." | The proposal, its "Adapted from the repository's Court Booking example", the conversation's usage line (`2-proposal`) | argument 2; pick a Readymade |
| 3 | "The 127 lines you would review were reviewed before you came: they ship with the board, and with its tests." | The review's summary: *Written for this board* lit, *Built from* with its counts (`3-review`) | argument 1 |
| 4 | "Deploy it, and add a member by her email address." | Deploy dialog, then the members dialog (`4-deploy`, `4-member`) | deployment is a block |
| 5 | "Ana opens it on her phone and takes tomorrow at six. The rest of her day closes: one hour per member." | Phone frame: shared list, *+1*, 18:00, confirm, her other hours dashed (`5-shared` … `5-booked`) | the rules hold |
| 5b | "Two people, one hour, the same moment. One of them gets it — and the other is told." | Both confirm dialogs, then the winner's hour and the loser's toast (`5b-race-*`, `5b-won`, `5b-lost`) | rules live in the database |
| 6 | "Back on the board, the booking arrives in the service that stored it, under the name the club gave her." | Sam's board: the SQL service's *Runs* — "Ana · 1 row changed" (`6-runs`) | observability, verified caller |
| 7 | "Built from blocks you don't have to review. Small enough to change with a sentence." | Board and phone side by side; readymade.me | the close |

**Why "tomorrow at six".** The board draws a day from the server's clock
(`date('now','localtime')`) and offers buttons for *Today* and *+1* … *+7*, not
weekdays. "Thursday at six" is only true on a Wednesday shoot; "tomorrow at six"
is the *+1* button and true on any day the take runs. The shoot pins the
server's zone (`TZ` in the film config) so "six" is the same hour for everyone.

**Script changes from v0**, each forced by the real app:
- *add a member by her email address*, not *share by email* — no email is sent;
- the price beside the conversation counts every request, documentation
  lookups included (beat 2);
- beats 2–3 (v2) say what the real run did: it found the shipped court board
  and adapted it, so the lines to review are the shipped ones — tested in
  `hkp-node/tests/court-booking-board.test.ts`, race included — not lines the
  assistant wrote;
- the race's loser is now told (beat 5b), by the board itself (below);
- beat 6 films the new *Runs* view, which names the member as the board's list
  does.

---

## What was built

| | What | Beats | Where |
| --- | --- | --- | --- |
| **P1** | Usage of every request a turn makes — input, output, cache writes and reads — summed per turn and over the conversation, priced from dated list prices; tokens alone for a model with no list price | 2 | `hkp-frontend/src/assist/usage.ts`, `anthropic.ts`, `openAICompatible.ts`, `BoardAssistPanel.tsx` |
| **P2** | Rehearsal harness for the prompt; the take is the acceptance check. **Open: the one real run** | 1–3 | `e2e/film/golden-path.film.ts` (`PROMPT`) |
| **P3** | The review says what was written and what it is built from — texts and their lines, services added/changed/removed, each block with the number of shipped boards using it | 3 | `hkp-frontend/src/assist/reviewSummary.ts`, `BoardAssistPreview.tsx` |
| **P4** | Real verification with harness identities: hkp-node takes `HKP_TEST_JWKS_URI` (checkout and loopback only); a JWKS server per start; signed id tokens for named people | 4–6 | `hkp-node/src/auth.ts`, `src/index.ts`; `e2e/support/jwks-server.mjs`, `identities.ts` |
| **P5** | The two-person pass, by machine: deploy, list a member, member attaches on a phone, books, owner watches; the race | 4–6 | `e2e/film/golden-path.film.ts` |
| **P6** | The member's phone is the mobile shell's Cloud tab (*Cloud Boards → Club cloud → Court Booking → Open board*); the calendar reads well at 393 px | 5 | as it was |
| **P7** | *Runs* in a service's panel on a deployed board: the coordinator sends the owner each log entry with its caller named as the list names them; `sql` logs counts per statement (never parameters) | 6 | `hkp-node/src/coordinator/session.ts`, `bridgeProtocol.ts`, `services/sql.ts`; `hkp-frontend/src/runtime/ui/ServiceRuns.tsx`, `views/cloud/useCoordinatorBridge.ts`, `ServiceFrame.tsx` |
| **P8** | Repeatable takes: disposable server data per run, fixed people, `TZ=Europe/Berlin`, fresh signing keys per start | all | `e2e/playwright.film.config.ts` |
| **P9** | The assistant's API traffic recorded once (`FILM_ASSIST=record`) and replayed in order; responses only, so no key reaches the tape | 1–3 | `e2e/film/assistTape.ts`, `e2e/film/tapes/` |
| — | The race's loser is told: **The day** returns a `notice` when a take did not land, raised by the facade only for the person who tapped | 5b | `boards/court-booking-*.json`, `hkp-node/tests/court-booking-board.test.ts` |
| — | Stills and the boxes of what the narration names, per shot | all | `e2e/film/shots.ts` → `…/videos/golden-path/shots.json` |

## Break log

What the rehearsal found that the unit suites had not.

| Beat | What broke | Cause | Fix | State |
| --- | --- | --- | --- | --- |
| 5 | A member's calendar drew nothing — on every shared board whose facade reads a list and a path into it | Member projection wrote `rows.0.day` after `rows`, rebuilding the array as `{ "0": … }` | A path inside one already picked whole is skipped (`facadeAccess.ts` `pick`) | fixed, tested |
| 1, 4 | An undeployed board with a remote runtime opened on an empty calendar until something was tapped | Facade `init` ran before the REST runtime's output socket was open; its notification went nowhere | Init waits for the runtimes it calls (`RuntimeRestScope.whenConnected`, 5 s ceiling) | fixed, tested |
| 5b | The race's loser saw the hour turn taken, and nothing else | The insert's guard makes nothing, silently | The board's `notice` | fixed, tested |
| 5b | Sam's hour showed to Ana as *Member* | By design: the owner is named only if their own list names them (`bridge.ts`) | Sam lists himself, off camera | open question below |
| — | `npm ci` had never run in hkp-node or hkp-frontend checkouts: `expression-eval` missing, so `auth.test.ts` and `tsc` failed | environment | `npm ci` | done |

## What the real run did

Two requests, **35,694 tokens (31,389 read, 4,305 written), about $0.21**. The
first read `boards/court-booking-demo-board.json` and its docs page; the second
proposed that board back, adapted — two of its three statements byte for byte,
the third and the facade with shorter comments and one shorter hint. It said
so itself: *"Adapted from the repository's Court Booking example."* The board
passed every rule the take asserts, the race included.

So the script's beat 2–3 wording, which implies the assistant *wrote* the
statements, is not what happened. What happened is arguably the better story:

- **beat 2** — "The assistant finds the club board Readymade already ships and
  makes it yours. The whole conversation took 35,694 tokens — about 21 cents."
- **beat 3** — "The 127 lines you would review were reviewed before you came:
  they ship with the board, and with its tests." True: the statements are the
  ones `hkp-node/tests/court-booking-board.test.ts` runs, race included.

That is the commercial pitch's *Pick a Readymade. Make it yours.* on screen.
The alternative is a second recording with a prompt the repository has no
board for, which films real generation at the price of argument 1.

Also seen: 4,190 of the 4,305 output tokens re-emit a board that barely
changed, because `propose_board` takes the complete board. A proposal that
starts from a shipped board by reference and states only its changes would
cut that by an order of magnitude — argument 2, made stronger by the product
rather than the narration.

## Running it

```sh
cd e2e
npm run film                                       # a take; beats 1–3 only if a tape exists
FILM_ASSIST=record ANTHROPIC_API_KEY=… npm run film  # the one real run — writes film/tapes/golden-path.json
FILM_TAPE=/tmp/tape.json npm run film              # rehearse on another tape
```

The take writes stills to `hkp-website/media/readymade-explainer/remotion/videos/golden-path/footage/`
(ignored) and `shots.json` beside it (committed): each shot's file, beat,
screen, size and the boxes of the things the narration names. Figures — the
conversation's usage, the review's count, who won the race — are written there
from the take that measured them.

---

## Phases

0. **Script lock.** v1 above. *Gate: the narration reads well aloud and every
   claim is allowed by rule 4.*
1. ~~Rehearsal by hand~~ — done by machine; see the break log.
2. ~~Preliminary work~~ — done, but for P2's run.
3. **Shoot.** Record the real run, then a take on it. *Gate: the board the model
   proposes passes the take (every rule the narration claims is asserted there),
   and a contact sheet of the stills is approved before any animation.*
4. **Cut.** Built: `remotion/videos/golden-path/` — `video.json` holds script
   v2 as narration cues, figures spoken in words and written in digits
   (`written`); `src/Composition.tsx` frames the stills (a glass window for
   Sam, a phone for Ana), moves the camera along named boxes, lights them, counts
   to the measured tokens and lenses the loser's toast. `tools/generate.py`
   stages the footage (`publicAssets`). *Gate: review of the narrated cut.*
5. **Publish.** Website use-cases, the court booking docs page; the pricing
   page later, when the commercial offer is public.

---

## Open decisions

- [x] **The real run.** Recorded 2026-10-20; passed the take.
- [x] **Adapted, or generated?** Adapted — script v2 tells the run as
      recorded (2026-10-20).
- [x] **Commit the tape?** Yes (2026-10-20).
- [ ] **A comparison figure.** "[N] tokens" alone is honest but has no scale. A
      real comparison means having Claude Code build the same app on a
      conventional stack and counting. Worth doing once, as its own experiment;
      no guessed figure on screen meanwhile.
- [ ] **Where to shoot.** The local harness is what runs today. The hosted
      deployment with two real accounts would be the real thing; the take
      needs only a different config to point at it.
- [ ] **The phone.** Chromium's iPhone emulation in a drawn frame (what the
      take does now), or a recording from a real device for beat 5.
- [ ] **The owner's name.** Unlisted, the owner books as *Member*. Should the
      owner be named from their own account when their list does not name
      them? A product question, not the video's.
- [ ] **Theme and length.** Glass, as the other explainers, and about 95 s.
