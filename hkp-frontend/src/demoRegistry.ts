import { BoardDescriptor } from "./types";

import alpacaBoard from "../boards/alpaca-board.json";
import smoothDemoBoard from "../boards/smooth-demo-board.json";
import helloworldBoard from "../boards/helloworld-board.json";
import asciiCamBoard from "../boards/ascii-cam-board.json";
import animateBoard from "../boards/animate-board.json";
import gameOfLifeBoard from "../boards/game-of-life-board.json";
import gameBoard from "../boards/game-board.json";
import audiolizeBoard from "../boards/audiolize-board.json";
import triggerpadBoard from "../boards/triggerpad-board.json";
import spectralModifierBoard from "../boards/spectral-modifier-board.json";
import noiseAlertBoard from "../boards/noise-alert-board.json";
import peerChatBoard from "../boards/peer-chat-board.json";
import peerChatNodeBoard from "../boards/peer-chat-node-board.json";
import dropitappBoard from "../boards/dropitapp-board.json";
import liveLocationBoard from "../boards/live-location-demo-board.json";
import microphoneSpeakerBoard from "../boards/microphone-speaker-demo-board.json";
import relayBoard from "../boards/relay.json";
import linkDebuggerBoard from "../boards/link-debugger.json";
import spotifyBoard from "../boards/spotify-board.json";
import encryptBoard from "../boards/encrypt-board.json";

const REGISTRY: Record<string, BoardDescriptor> = {
  "alpaca-markets": alpacaBoard as unknown as BoardDescriptor,
  "smooth": smoothDemoBoard as unknown as BoardDescriptor,
  "hello-world": helloworldBoard as unknown as BoardDescriptor,
  "ascii-cam": asciiCamBoard as unknown as BoardDescriptor,
  "animate": animateBoard as unknown as BoardDescriptor,
  "game-of-life": gameOfLifeBoard as unknown as BoardDescriptor,
  "breakout-game": gameBoard as unknown as BoardDescriptor,
  "audiolize": audiolizeBoard as unknown as BoardDescriptor,
  "trigger-pad": triggerpadBoard as unknown as BoardDescriptor,
  "spectral-modifier": spectralModifierBoard as unknown as BoardDescriptor,
  "noise-alert": noiseAlertBoard as unknown as BoardDescriptor,
  "peer-chat": peerChatBoard as unknown as BoardDescriptor,
  "peer-chat-with-node": peerChatNodeBoard as unknown as BoardDescriptor,
  "drop-it-app": dropitappBoard as unknown as BoardDescriptor,
  "live-location": liveLocationBoard as unknown as BoardDescriptor,
  "microphone-speaker": microphoneSpeakerBoard as unknown as BoardDescriptor,
  "relay": relayBoard as unknown as BoardDescriptor,
  "link-debugger": linkDebuggerBoard as unknown as BoardDescriptor,
  "spotify-to-github": spotifyBoard as unknown as BoardDescriptor,
  "encrypt-decrypt": encryptBoard as unknown as BoardDescriptor,
};

export function findDemoBoard(slug: string): BoardDescriptor | undefined {
  return REGISTRY[slug.toLowerCase()];
}
