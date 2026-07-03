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
};

export const DEMO_CATALOG: DemoCatalogEntry[] = [
  {
    slug: "alpaca-markets",
    label: "Alpaca Markets",
    description:
      "Live stock trade feed via Alpaca WebSocket — enter your API key to watch real-time trades roll in.",
    icon: "📈",
    tags: ["Live data", "WebSocket", "API key"],
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
    description: "Render your webcam feed as ASCII art entirely in the browser.",
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
    slug: "peer-chat",
    label: "Peer Chat",
    description:
      "Two-way text chat between browser tabs over WebRTC — no server, no account.",
    icon: "💬",
    tags: ["WebRTC", "P2P"],
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
    tags: ["API key"],
  },
  {
    slug: "encrypt-decrypt",
    label: "Encrypt / Decrypt",
    description:
      "AES-GCM encrypt in one runtime, decrypt in another — verifies the round-trip.",
    icon: "🔐",
    tags: ["Crypto"],
  },
];

export const ALL_DEMO_TAGS = Array.from(
  new Set(DEMO_CATALOG.flatMap((e) => e.tags)),
).sort();

export function demoBoardFor(entry: DemoCatalogEntry): BoardDescriptor | undefined {
  return findDemoBoard(entry.slug);
}
