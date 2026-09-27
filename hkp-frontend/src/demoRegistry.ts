import { BoardDescriptor } from "./types";

import alpacaBoard from "../../boards/alpaca-board.json";
import smoothDemoBoard from "../../boards/smooth-demo-board.json";
import helloworldBoard from "../../boards/helloworld-board.json";
import asciiCamBoard from "../../boards/ascii-cam-board.json";
import animateBoard from "../../boards/animate-board.json";
import gameOfLifeBoard from "../../boards/game-of-life-board.json";
import gameBoard from "../../boards/game-board.json";
import audiolizeBoard from "../../boards/audiolize-board.json";
import triggerpadBoard from "../../boards/triggerpad-board.json";
import spectralModifierBoard from "../../boards/spectral-modifier-board.json";
import noiseAlertBoard from "../../boards/noise-alert-board.json";
import peerChatBoard from "../../boards/peer-chat-board.json";
import peerChatNodeBoard from "../../boards/peer-chat-node-board.json";
import p2pSenderBoard from "../../boards/p2p-sender-demo-board.json";
import p2pReceiverBoard from "../../boards/p2p-receiver-demo-board.json";
import dropitappBoard from "../../boards/dropitapp-board.json";
import liveLocationBoard from "../../boards/live-location-demo-board.json";
import microphoneSpeakerBoard from "../../boards/microphone-speaker-demo-board.json";
import linkDebuggerBoard from "../../boards/link-debugger.json";
import spotifyBoard from "../../boards/spotify-board.json";
import encryptBoard from "../../boards/encrypt-board.json";
import voiceNotesBoard from "../../boards/speech-to-text-demo-board.json";
import httpClientBoard from "../../boards/http-client-demo-board.json";
import httpClientBrowserBoard from "../../boards/http-client-browser-demo-board.json";
import mountedEndpointBoard from "../../boards/mounted-endpoint-demo-board.json";
import uuidGeneratorBoard from "../../boards/uuid-generator-demo-board.json";
import courtBookingBoard from "../../boards/court-booking-demo-board.json";
import rssAggregatorBoard from "../../boards/rss-demo-board.json";
import meetingPollBoard from "../../boards/meeting-poll-demo-board.json";
import nestedRhythmBoard from "../../boards/nested-rhythm-demo-board.json";

const REGISTRY: Record<string, BoardDescriptor> = {
  "alpaca-markets": alpacaBoard as BoardDescriptor,
  smooth: smoothDemoBoard as BoardDescriptor,
  "hello-world": helloworldBoard as BoardDescriptor,
  "ascii-cam": asciiCamBoard as BoardDescriptor,
  animate: animateBoard as BoardDescriptor,
  "game-of-life": gameOfLifeBoard as BoardDescriptor,
  "breakout-game": gameBoard as BoardDescriptor,
  audiolize: audiolizeBoard as BoardDescriptor,
  "trigger-pad": triggerpadBoard as BoardDescriptor,
  "spectral-modifier": spectralModifierBoard as BoardDescriptor,
  "noise-alert": noiseAlertBoard as BoardDescriptor,
  "peer-chat": peerChatBoard as BoardDescriptor,
  "peer-chat-with-node": peerChatNodeBoard as BoardDescriptor,
  "p2p-sender": p2pSenderBoard as BoardDescriptor,
  "p2p-receiver": p2pReceiverBoard as BoardDescriptor,
  "drop-it-app": dropitappBoard as BoardDescriptor,
  "live-location": liveLocationBoard as BoardDescriptor,
  "microphone-speaker": microphoneSpeakerBoard as BoardDescriptor,
  "link-debugger": linkDebuggerBoard as BoardDescriptor,
  "spotify-to-github": spotifyBoard as BoardDescriptor,
  "encrypt-decrypt": encryptBoard as BoardDescriptor,
  "voice-notes": voiceNotesBoard as BoardDescriptor,
  "http-client": httpClientBoard as BoardDescriptor,
  "http-client-browser": httpClientBrowserBoard as BoardDescriptor,
  "mounted-endpoint": mountedEndpointBoard as BoardDescriptor,
  "uuid-generator": uuidGeneratorBoard as BoardDescriptor,
  "court-booking": courtBookingBoard as BoardDescriptor,
  "rss-aggregator": rssAggregatorBoard as BoardDescriptor,
  "meeting-poll": meetingPollBoard as BoardDescriptor,
  "nested-rhythm": nestedRhythmBoard as BoardDescriptor,
};

export function findDemoBoard(slug: string): BoardDescriptor | undefined {
  return REGISTRY[slug.toLowerCase()];
}
