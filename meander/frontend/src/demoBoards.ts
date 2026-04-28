import { BoardDescriptor } from "hkp-frontend/src/types";

import asciiCamBoard from "../../../hkp-frontend/boards/ascii-cam-board.json";
import dropitappBoard from "../../../hkp-frontend/boards/dropitapp-board.json";
import gameOfLifeBoard from "../../../hkp-frontend/boards/game-of-life-board.json";
import linkDebuggerBoard from "../../../hkp-frontend/boards/link-debugger.json";
import noiseAlertBoard from "../../../hkp-frontend/boards/noise-alert-board.json";
import peerChatBoard from "../../../hkp-frontend/boards/peer-chat-board.json";
import relayBoard from "../../../hkp-frontend/boards/relay.json";
import helloworldBoard from "../../../hkp-frontend/boards/helloworld-board.json";
import animateBoard from "../../../hkp-frontend/boards/animate-board.json";
import audiolizeBoard from "../../../hkp-frontend/boards/audiolize-board.json";
import spotifyBoard from "../../../hkp-frontend/boards/spotify-board.json";
import triggerpadBoard from "../../../hkp-frontend/boards/triggerpad-board.json";
import gameBoard from "../../../hkp-frontend/boards/game-board.json";
import encryptBoard from "../../../hkp-frontend/boards/encrypt-board.json";
import peerChatRtBoard from "../../../hkp-frontend/boards/peer-chat-rt-board.json";
import spectralModifierBoard from "../../../hkp-frontend/boards/spectral-modifier-board.json";
import smoothDemoBoard from "../../../hkp-frontend/boards/smooth-demo-board.json";

export type DemoEntry = {
  label: string;
  description: string;
  icon: string;
  board: BoardDescriptor;
};

export const DEMO_BOARDS: DemoEntry[] = [
  {
    label: "Smooth",
    description:
      "A noisy signal (red) vs its exponential moving average (blue) — adjust the factor knob live",
    icon: "〰️",
    board: smoothDemoBoard as unknown as BoardDescriptor,
  },
  {
    label: "Hello World",
    description:
      "A timer driving a canvas that counts up — the simplest possible board",
    icon: "👋",
    board: helloworldBoard as unknown as BoardDescriptor,
  },
  {
    label: "ASCII Cam",
    description: "Render your webcam as ASCII art in the browser",
    icon: "📷",
    board: asciiCamBoard as unknown as BoardDescriptor,
  },
  {
    label: "Animate",
    description:
      "Parallax scrolling scene rendered on canvas using emoji sprites",
    icon: "🌳",
    board: animateBoard as unknown as BoardDescriptor,
  },
  {
    label: "Game of Life",
    description: "Conway's Game of Life running in the browser runtime",
    icon: "🧬",
    board: gameOfLifeBoard as unknown as BoardDescriptor,
  },
  {
    label: "Breakout Game",
    description:
      "Ball and paddle game controlled by the XY pad — all running in the browser",
    icon: "🎮",
    board: gameBoard as unknown as BoardDescriptor,
  },
  {
    label: "Audiolize",
    description: "Turn Wikipedia edits into live drum beats via a sampler",
    icon: "🥁",
    board: audiolizeBoard as unknown as BoardDescriptor,
  },
  {
    label: "Trigger Pad",
    description:
      "Audio loopback through a trigger pad — mic input to speaker output",
    icon: "🎙️",
    board: triggerpadBoard as unknown as BoardDescriptor,
  },
  {
    label: "Spectral Modifier",
    description:
      "Capture mic audio, visualise and filter the FFT spectrum, reconstruct via IFFT",
    icon: "🎚️",
    board: spectralModifierBoard as unknown as BoardDescriptor,
  },
  {
    label: "Noise Alert",
    description: "Detect loud sounds and trigger alerts",
    icon: "🔔",
    board: noiseAlertBoard as unknown as BoardDescriptor,
  },
  {
    label: "Peer Chat",
    description: "Two-way chat between browser tabs via WebRTC",
    icon: "💬",
    board: peerChatBoard as unknown as BoardDescriptor,
  },
  {
    label: "Peer Chat (hkp-rt)",
    description: "P2P chat via WebRTC using the hkp-rt signaling server",
    icon: "💬",
    board: peerChatRtBoard as unknown as BoardDescriptor,
  },
  {
    label: "Drop It App",
    description: "Drag-and-drop file sharing pipeline",
    icon: "📂",
    board: dropitappBoard as unknown as BoardDescriptor,
  },
  {
    label: "Relay",
    description: "Bridge an HTTP relay endpoint into a browser pipeline",
    icon: "🔗",
    board: relayBoard as unknown as BoardDescriptor,
  },
  {
    label: "Link Debugger",
    description: "Decompress and inspect board QR link contents",
    icon: "🔍",
    board: linkDebuggerBoard as unknown as BoardDescriptor,
  },
  {
    label: "Spotify to GitHub",
    description: "Archive your Spotify liked tracks to a GitHub repository",
    icon: "🎵",
    board: spotifyBoard as unknown as BoardDescriptor,
  },
  {
    label: "Encrypt / Decrypt",
    description:
      "AES-GCM encrypt in one runtime, decrypt in another — verify round-trip",
    icon: "🔐",
    board: encryptBoard as unknown as BoardDescriptor,
  },
];
