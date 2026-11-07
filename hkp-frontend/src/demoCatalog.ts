import { BoardDescriptor } from "./types";
import { findDemoBoard } from "./demoRegistry";

/**
 * Shared catalog of the published demo boards (the "HookHub" set). The slugs
 * key into demoRegistry.ts; the tags drive the Demos folder of the start page
 * and the tag filter on the website's board hub.
 */
export type DemoCatalogEntry = {
  slug: string;
  label: string;
  description: string;
  icon: string;
  tags: string[];
} & DemoSpotlight;

/** How a pick opens, and the only way its card leads: one click in the
 *  browser, the Readymade app (a board on `remote: embedded`), or a video for
 *  anything that needs a runtime server a visitor does not have. */
export type DemoOpens = "browser" | "app" | "video";

export type DemoMedia =
  | { video: string; poster: string; alt: string }
  | { image: string; alt: string };

/**
 * What the pitch's gallery says about a pick (see demoShelves.ts). All of it
 * optional, so an entry nobody spotlights is unaffected, and the start page
 * and the board hub keep reading the same entries.
 */
export type DemoSpotlight = {
  /** What you get, not what it shows: "Your club's courts, bookable from a
   *  phone, never double-booked." */
  outcome?: string;
  /** What to do once it is open, and what you will see happen. */
  expect?: string;
  /** The concept it shows, linked to the page that explains it. */
  underTheHood?: { text: string; href: string };
  opens?: DemoOpens;
  /** For a video pick: the board itself, for people who run their own
   *  runtime servers, and which ones it needs. */
  runItYourself?: { href: string; needs: string };
  /** For a browser version: what deploying the board changes. Its data
   *  lives in this browser, for one person, until then. */
  deployed?: string;
  media?: DemoMedia;
  /** Further boards shown with this one as a group pick, by slug. */
  members?: string[];
};

export const DEMO_CATALOG: DemoCatalogEntry[] = [
  {
    slug: "alpaca-markets",
    label: "Alpaca Markets",
    description:
      "Live stock trade feed via Alpaca WebSocket — enter your API key to watch real-time trades roll in.",
    icon: "📈",
    tags: ["Live data", "WebSocket"],
  },
  {
    slug: "smooth",
    label: "Smooth",
    description:
      "A noisy signal (red) vs its exponential moving average (blue) — adjust the factor knob live.",
    icon: "〰️",
    tags: ["Canvas", "Signal"],
  },
  {
    slug: "hello-world",
    label: "Hello World",
    description:
      "A timer driving a canvas counter — the simplest possible board. Start here.",
    icon: "👋",
    tags: ["Canvas"],
  },
  {
    slug: "ascii-cam",
    label: "ASCII Cam",
    description:
      "Render your webcam feed as ASCII art entirely in the browser.",
    icon: "📷",
    tags: ["Camera", "Canvas"],
  },
  {
    slug: "animate",
    label: "Animate",
    description:
      "Parallax scrolling scene rendered on canvas using emoji sprites.",
    icon: "🌳",
    tags: ["Canvas", "Animation"],
  },
  {
    slug: "game-of-life",
    label: "Game of Life",
    description:
      "Conway's Game of Life running as a board — start, pause, and watch it evolve.",
    icon: "🧬",
    tags: ["Canvas", "Simulation"],
  },
  {
    slug: "breakout-game",
    label: "Breakout Game",
    description:
      "Ball and paddle game controlled by the XY pad. All services in the browser.",
    icon: "🎮",
    tags: ["Canvas", "Game"],
  },
  {
    slug: "audiolize",
    label: "Audiolize",
    description:
      "Turn Wikipedia edits into live drum beats via a sampler — real-time data becomes sound.",
    icon: "🥁",
    tags: ["Audio", "Live data", "WebSocket"],
  },
  {
    slug: "trigger-pad",
    label: "Trigger Pad",
    description:
      "Audio loopback through a trigger pad — mic input captured and routed to speaker output.",
    icon: "🎙️",
    tags: ["Audio"],
  },
  {
    slug: "noise-alert",
    label: "Noise Alert",
    description:
      "Listens through the microphone and triggers a visual alert when sounds cross a threshold.",
    icon: "🔔",
    tags: ["Audio"],
  },
  {
    slug: "face-alert",
    label: "Face Alert",
    description:
      "Watches the camera and sends a push notification through ntfy when a face appears — once, not every frame. Faces are found on the device; only the message leaves it, to a topic made at random for your copy.",
    icon: "👤",
    tags: ["Camera"],
  },
  {
    slug: "peer-chat",
    label: "Peer Chat",
    description:
      "Two-way text chat between browser tabs over WebRTC — no server, no account.",
    icon: "💬",
    tags: ["P2P"],
  },
  {
    slug: "p2p-sender",
    label: "P2P Sender",
    description:
      "Inject text and push it to a peer over WebRTC — pair it with the P2P Receiver. Edit the board to send other data types.",
    icon: "📤",
    tags: ["P2P"],
  },
  {
    slug: "p2p-receiver",
    label: "P2P Receiver",
    description:
      "Receives whatever the P2P Sender pushes over WebRTC and shows it in a live monitor — no server, no account.",
    icon: "📥",
    tags: ["P2P"],
  },
  {
    slug: "drop-it-app",
    label: "Drop It App",
    description:
      "Drag-and-drop a file to share it — pipeline encodes and transfers between runtimes.",
    icon: "📂",
    tags: ["File sharing", "Needs Node"],
  },
  {
    slug: "live-location",
    label: "Live Location",
    description:
      "Share your phone's live GPS over a link — the device runs a tiny HTTP server and serves its coordinates. On when you run it, off when you don't.",
    icon: "📍",
    tags: ["Location", "iOS only", "Needs app"],
  },
  {
    slug: "spotify-to-github",
    label: "Spotify to GitHub",
    description:
      "Archive your Spotify liked tracks to a GitHub repository as a JSON file.",
    icon: "🎵",
    tags: ["Integration"],
  },
  {
    slug: "voice-notes",
    label: "Voice Notes",
    description:
      "Speak and get the transcript — the browser records PCM audio, a local Whisper model in the Python runtime transcribes it, and the text flows back into a monitor.",
    icon: "🗣️",
    tags: ["Audio", "Needs Python"],
  },
  {
    slug: "encrypt-decrypt",
    label: "Encrypt / Decrypt",
    description:
      "AES-GCM encrypt in one runtime, decrypt in another — verifies the round-trip.",
    icon: "🔐",
    tags: ["Crypto"],
  },
  {
    slug: "http-client",
    label: "HTTP Client",
    description:
      "Compose a request — URL, query parameters, headers, body — send it from the Node runtime and read the response. Nothing the browser could do itself: no CORS policy has a say, and a credential in a header never reaches the page.",
    icon: "🔌",
    tags: ["HTTP", "Needs Node"],
  },
  {
    slug: "http-client-browser",
    label: "HTTP Client (Browser)",
    description:
      "The same request composer with nothing to install: the browser makes the call itself. Works wherever the API allows this origin — and the request, headers and all, is in the page.",
    icon: "🔌",
    tags: ["HTTP"],
  },
  {
    slug: "mounted-endpoint",
    label: "Mounted Endpoint",
    description:
      "One runtime hosts an endpoint, another calls it. Neither board nor service knows the address: the endpoint names its owner, and the board's coordinator resolves it once the runtime assigns one.",
    icon: "🔗",
    tags: ["Mounts", "HTTP", "Needs Node"],
  },
  {
    slug: "uuid-generator",
    label: "UUID Generator",
    description:
      "A fresh identifier, v4 or v1, ready to copy — or one a second for as long as you leave it running. The website you would otherwise have open in a tab, as three services.",
    icon: "🆔",
    tags: ["Utility"],
  },
  {
    slug: "court-booking",
    label: "Court Booking",
    description:
      "Three tennis courts as an hourly timetable: tap a free hour to take it, tap your own to give it back. Both club rules — no double booking, one hour per member per day — are unique indexes, so the database refuses what the grid would not offer.",
    icon: "🎾",
    tags: ["Needs Node", "SQL"],
  },
  {
    slug: "swimlanes",
    label: "Swimlanes",
    description:
      "Five SQL-backed lanes composed from independent facade widgets. Create cards where a lane permits it, edit or delete them anywhere, and drag them between or within lanes to reorder them.",
    icon: "🗂️",
    tags: ["Needs Node", "SQL"],
  },
  {
    slug: "health-log",
    label: "Private Health Log",
    description:
      "Keep your own timestamped blood-glucose, blood-pressure and weight history in SQLite, inspect it as tables and time-series charts, and expose each new event to an optional analytics board.",
    icon: "🩺",
    tags: ["Needs Node", "SQL", "Personal Data"],
  },
  {
    slug: "court-booking-browser",
    label: "Court Booking (Browser)",
    description:
      "The same court timetable with nothing to install: SQLite runs in the browser and keeps the bookings between visits. The club rules are still unique indexes — what it gives up is the club, since the tables belong to this browser alone.",
    icon: "🎾",
    tags: ["SQL"],
    outcome: "Your club's courts, bookable from a phone, never double-booked.",
    expect:
      "Tap a free hour to take it, tap yours to give it back. Try a second hour on the same day: the database turns it down.",
    underTheHood: {
      text: "Club rules as unique indexes, not checks in the page",
      href: "/documentation/boards/court-booking-browser-demo-board/",
    },
    opens: "browser",
    media: {
      video: "/images/pitch/court-booking.mp4",
      poster: "/images/pitch/court-booking.jpg",
      alt: "Court Booking deployed: a member takes an hour on her phone, then two people confirm the same hour and the one who loses is told.",
    },
    deployed:
      "Deployed, the club shares one database, kept while nobody is watching, and every booking is in the name of the member who signed in.",
  },
  {
    slug: "sql-explorer",
    label: "SQL Explorer",
    description:
      "Every SQL database this browser keeps: pick one to see its tables, a table to see its rows — click a value to change it, tick rows to delete them — and export any of them as an ordinary SQL dump, the file hkp-node imports to carry on with the same tables.",
    icon: "🗄️",
    tags: ["SQL", "Utility"],
  },
  {
    slug: "sql-explorer-node",
    label: "SQL Explorer (hkp-node)",
    description:
      "Every SQL database your hkp-node keeps for you — the ones your boards made there, deployed ones included, and nobody else's: pick one to see its tables, a table to see its rows, change a value, delete rows, and export any of them as an ordinary SQL dump.",
    icon: "🗄️",
    tags: ["SQL", "Utility", "Needs Node"],
  },
  {
    slug: "sql-import",
    label: "SQL Import",
    description:
      "Pick an SQL dump, name a database, send it: hkp-node imports it in one transaction, all of it or none, and every board there naming that database carries on with its tables.",
    icon: "📥",
    tags: ["SQL", "Needs Node"],
  },
  {
    slug: "rss-aggregator",
    label: "RSS Aggregator",
    description:
      "Any number of RSS or Atom feeds read as one list, newest first, with Hacker News among them. Paste a URL to subscribe; save an article and it goes into a SQL reading list that outlives the feed page it came from.",
    icon: "📰",
    tags: ["Needs Node", "SQL"],
  },
  {
    slug: "hacker-news",
    label: "Hacker News Reader",
    description:
      "Hacker News as an app: the front page, New, Best, Ask and Show, and a search over every story ever posted. Open a story's comments beside the list, every reply under the comment it answers; fold a branch to skip it, and it is still folded next time. Everything runs in the browser.",
    icon: "🗞️",
    tags: ["Live data", "SQL"],
    outcome: "Hacker News to read, not to scroll: whole threads, folded where you left them.",
    expect:
      "Pick a list or search, then open a story's comments: the thread appears beside the list. Fold a branch with [–], or Collapse all and open the ones worth reading.",
    underTheHood: {
      text: "Two APIs' answers joined by SQL in the browser",
      href: "/documentation/boards/hacker-news-board/",
    },
    opens: "browser",
    media: {
      image: "/images/pitch/hacker-news.jpg",
      alt: "HN Reader: the front page beside the discussion of its busiest story, every reply under the comment it answers, one branch folded.",
    },
  },
  {
    slug: "health-log-browser",
    label: "Private Health Log (Browser)",
    description:
      "The same personal health log with nothing to install: SQLite runs in the browser and keeps the history between visits. Blood glucose, blood pressure, weight and a daily journal, as tables and time-series charts — a record of what you enter, not a medical device. What it gives up is reach: the history belongs to this browser on this device alone, and leaves it as a .sqlite file any SQLite tool opens.",
    icon: "🩺",
    tags: ["SQL", "Personal Data"],
    outcome: "Your glucose, blood pressure and weight, charted, in a record that is yours.",
    expect:
      "Log a value, or Generate fake data under Your data for six months of history. Then open Trends and hover a point: that day's journal is beside it.",
    underTheHood: {
      text: "One SQL query feeding a table and three charts",
      href: "/documentation/boards/health-log-browser-demo-board/",
    },
    opens: "browser",
    media: {
      video: "/images/pitch/health-log.mp4",
      poster: "/images/pitch/health-log.jpg",
      alt: "Health Log in the browser: a glucose value logged, six months of fictional history charted with a day's journal beside its value, and the history exported as a .sqlite file.",
    },
    deployed:
      "Deployed, the history lives on a runtime you choose, and you open the same log from your phone and your laptop.",
  },
  {
    slug: "meeting-poll-browser",
    label: "Meeting Poll (Browser)",
    description:
      "The same meeting poll with nothing to install: SQLite runs in the browser and keeps the polls between visits. Whoever is signed in is the owner here — calls the meeting, puts up the dates and answers them — and the database still turns down what the page would not offer. What it gives up is the team, since the tables belong to this browser alone.",
    icon: "🗳️",
    tags: ["SQL"],
    outcome: "A date everybody can make, without the email thread.",
    expect:
      "Signed in, call a meeting, put up two or three dates and say which ones work. Close the poll and try to answer again: the database turns it down.",
    underTheHood: {
      text: "Who may do what as triggers and indexes in the schema",
      href: "/documentation/boards/meeting-poll-browser-demo-board/",
    },
    opens: "browser",
    media: {
      video: "/images/pitch/meeting-poll.mp4",
      poster: "/images/pitch/meeting-poll.jpg",
      alt: "Meeting Poll deployed: two members answer on their phones, the owner sees the best date, closes the poll, and a late answer is turned down.",
    },
    deployed:
      "Deployed and shared, the team answers one poll, each member as themselves, and only the owner sets it up.",
  },
  {
    slug: "rss-radio",
    label: "Reading Radio",
    description:
      "Anything that publishes RSS or Atom, as a podcast: a reading list, a brief of each article written by a model, read aloud and served at an address any podcast player can follow. Five units, each of which runs on its own.",
    icon: "🎧",
    tags: ["Needs Node", "Needs Python", "Audio"],
    outcome: "The articles you meant to read, as a podcast for the way to work.",
    expect:
      "Watch articles dragged onto the reading list be briefed by a model, voiced, and land on air with a player on their card — and hear the radio read one.",
    underTheHood: {
      text: "Five units joined by feeds and mount references, not wires",
      href: "/documentation/boards/rss-radio-board/",
    },
    opens: "video",
    media: {
      video: "/images/pitch/rss-radio.mp4",
      poster: "/images/pitch/rss-radio.jpg",
      alt: "Reading Radio's five lanes: three Hacker News articles dragged onto the reading list, briefed by a model, voiced, and on air with a player on each card.",
    },
    runItYourself: {
      href: "/playground?demo=rss-radio",
      needs:
        "an hkp-node and an hkp-python kept under the names node and python, and an Anthropic key",
    },
  },
  {
    slug: "syn-mail-desk",
    label: "AI Collaboration",
    description:
      "Enquiries arrive by email, a model drafts each reply, and a person decides. Three lanes — incoming, needs review, waiting for the customer: drag a draft across to approve it and it goes out over SMTP, or edit it first.",
    icon: "📬",
    tags: ["Needs Node", "Integration"],
    outcome: "Every enquiry answered, and every reply read by a person before it goes.",
    expect:
      "Watch mail arrive in the first lane, a drafted reply appear for review, and an approved one leave for the customer as it is dragged across.",
    underTheHood: {
      text: "A review facade on an existing app, its units included unchanged",
      href: "/documentation/boards/syn-mail-desk-board/",
    },
    opens: "video",
    runItYourself: {
      href: "/playground?demo=syn-mail-desk",
      needs:
        "an hkp-node kept under the name node, an IMAP and SMTP mailbox, and an Anthropic key",
    },
  },
  {
    slug: "meeting-poll",
    label: "Meeting Poll",
    description:
      "Dates for a meeting, answered by everyone it is put to: the board's owner calls meetings and puts times up, each member says which ones work \u2014 none, one or all of them, as themselves. Who may propose a date and who may answer at all are triggers and indexes, so the database turns down what the page would not offer, and says why.",
    icon: "🗳️",
    tags: ["Needs Node", "SQL"],
  },
  {
    slug: "nested-rhythm",
    label: "Nested Rhythm",
    description:
      "A drum groove timed by nothing but nesting: four patterns — Straight, Shuffle, Four on the floor, Funk — each a bar built from small blocks like a Beat of two hi-hats. Every wait is in beats; tempo and pattern are slots in the outermost scope that every level inherits. Switch patterns and watch the playhead move down through the levels.",
    icon: "🥁",
    tags: ["Audio", "Sequencing"],
    outcome:
      "Four drum grooves, switched at the bar line, timed by nothing but nesting.",
    expect:
      "Press Play, pick a pattern, turn the tempo. Open the board to watch the playhead move down through the levels.",
    underTheHood: {
      text: "Nested sub-services and the scope they share",
      href: "/documentation/boards/nested-rhythm-demo-board/",
    },
    opens: "browser",
    media: {
      video: "/images/pitch/NestingBeatsHi.mp4",
      poster: "/images/pitch/NestingBeatsHi-poster.jpg",
      alt: "The Nested Rhythm board, its playhead moving down through nested services.",
    },
    members: ["timeline", "night-groove"],
  },
  {
    slug: "timeline",
    label: "Timeline",
    description:
      "A night sky that plays for eight seconds and loops: stars pop up, a planet appears, a rocket and a comet fly across. No animation code — every image is keyframed on a timeline of its own, and one outer timeline arranges them all.",
    icon: "🌠",
    tags: ["Canvas", "Animation", "Sequencing"],
    outcome: "An animated scene made of keyframes, without animation code.",
    underTheHood: {
      text: "Timelines inside a timeline, motions written once as blocks",
      href: "/documentation/boards/timeline-demo-board/",
    },
    opens: "browser",
  },
  {
    slug: "night-groove",
    label: "Night Groove",
    description:
      "The Timeline demo's night sky with a drum groove under it, both played by one clock counting in beats. Hi-hats, kick, snare and a fill come in bar by bar while the stars, rocket, planet and comet arrive with them, and a moon beats with every kick. Pause silences the band and holds the picture together; the tempo knob speeds up both.",
    icon: "🌙",
    tags: ["Audio", "Animation", "Sequencing"],
    outcome:
      "Sound and picture on one clock, in time without scheduling anything.",
    expect:
      "Press Play and watch the moon beat with the kick. Turn the tempo and the band and the sky follow together.",
    underTheHood: {
      text: "One timeline arranging drums and images alike",
      href: "/documentation/boards/night-groove-demo-board/",
    },
    opens: "browser",
  },
  {
    slug: "live-radio",
    label: "Live Radio",
    description:
      "Your microphone as a radio station: hkp-rt captures it, encodes it to MP3 as it arrives and streams it to anyone who opens the URL or scans the QR code. Runs in the Readymade app, which carries hkp-rt.",
    icon: "📻",
    tags: ["Audio", "Needs app"],
    outcome: "Your microphone on air, for any phone that scans the code.",
    expect:
      "Press Start, then scan the QR code with a phone on the same network: it plays what the microphone hears, a fraction of a second later.",
    underTheHood: {
      text: "A C++ runtime streaming from the realtime audio thread",
      href: "/documentation/boards/live-radio-demo-board/",
    },
    opens: "app",
  },
  {
    slug: "shared-costs",
    label: "Shared Costs",
    description:
      "Shared costs for a flat: whoever paid adds what it was for and how much, it is split evenly between everyone in the flat at that moment, and each person sees what they owe or are owed. Board Assist composed it from one description — six SQL statements of its own on services other boards already use — and every expense is recorded for the signed-in caller the server verified.",
    icon: "💶",
    tags: ["Needs Node", "SQL"],
    outcome: "Who paid, who owes, and nobody doing the sums.",
    expect:
      "Watch the assistant compose it from one description, then one flatmate add the groceries and the other open the board to see what they owe.",
    underTheHood: {
      text: "Six new SQL statements on services other boards already use",
      href: "/documentation/boards/shared-costs-demo-board/",
    },
    opens: "video",
    runItYourself: {
      href: "/playground?demo=shared-costs",
      needs: "an hkp-node kept under the name node",
    },
    media: {
      video: "/images/pitch/shared-costs.mp4",
      poster: "/images/pitch/shared-costs.jpg",
      alt: "Board Assist composing the Shared Costs board from one description, then two flatmates using it on their phones.",
    },
  },
];

export const ALL_DEMO_TAGS = Array.from(
  new Set(DEMO_CATALOG.flatMap((e) => e.tags)),
).sort();

export function demoBoardFor(
  entry: DemoCatalogEntry,
): BoardDescriptor | undefined {
  return findDemoBoard(entry.slug);
}
