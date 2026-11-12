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
import faceAlertBoard from "../../boards/face-alert-board.json";
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
import swimlanesBoard from "../../boards/swimlanes-demo-board.json";
import healthLogBoard from "../../boards/health-log-demo-board.json";
import courtBookingBrowserBoard from "../../boards/court-booking-browser-demo-board.json";
import sqlExplorerBoard from "../../boards/sql-explorer-board.json";
import sqlExplorerNodeBoard from "../../boards/sql-explorer-node-board.json";
import sqlImportBoard from "../../boards/sql-import-board.json";
import rssAggregatorBoard from "../../boards/rss-demo-board.json";
import meetingPollBoard from "../../boards/meeting-poll-demo-board.json";
import nestedRhythmBoard from "../../boards/nested-rhythm-demo-board.json";
import timelineBoard from "../../boards/timeline-demo-board.json";
import nightGrooveBoard from "../../boards/night-groove-demo-board.json";
import liveRadioBoard from "../../boards/live-radio-demo-board.json";
import sharedCostsBoard from "../../boards/shared-costs-demo-board.json";
import hackerNewsBoard from "../../boards/hacker-news-board.json";
import healthLogBrowserBoard from "../../boards/health-log-browser-demo-board.json";
import meetingPollBrowserBoard from "../../boards/meeting-poll-browser-demo-board.json";
import notesBoard from "../../boards/notes-demo-board.json";
import rssRadioBoard from "../../boards/rss-radio-board.json";
import rssRadioEditorUnit from "../../boards/rss-radio-editor-unit-board.json";
import rssRadioVoiceUnit from "../../boards/rss-radio-voice-unit-board.json";
import rssRadioUnit from "../../boards/rss-radio-unit-board.json";
import rssRadioLibraryUnit from "../../boards/rss-radio-library-unit-board.json";
import rssRadioBriefOneBoard from "../../boards/rss-radio-brief-one-board.json";
import synMailDeskBoard from "../../boards/syn-mail-desk-board.json";
import synBookingUnit from "../../boards/syn-booking-unit-board.json";
import synHotelsUnit from "../../boards/syn-hotels-unit-board.json";
import synMailDeskUnit from "../../boards/syn-mail-desk-unit-board.json";

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
  "face-alert": faceAlertBoard as BoardDescriptor,
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
  swimlanes: swimlanesBoard as BoardDescriptor,
  "health-log": healthLogBoard as BoardDescriptor,
  "court-booking-browser": courtBookingBrowserBoard as BoardDescriptor,
  "sql-explorer": sqlExplorerBoard as BoardDescriptor,
  "sql-explorer-node": sqlExplorerNodeBoard as BoardDescriptor,
  "sql-import": sqlImportBoard as BoardDescriptor,
  "rss-aggregator": rssAggregatorBoard as BoardDescriptor,
  "meeting-poll": meetingPollBoard as BoardDescriptor,
  "nested-rhythm": nestedRhythmBoard as BoardDescriptor,
  timeline: timelineBoard as BoardDescriptor,
  "night-groove": nightGrooveBoard as BoardDescriptor,
  "live-radio": liveRadioBoard as BoardDescriptor,
  "shared-costs": sharedCostsBoard as BoardDescriptor,
  "hacker-news": hackerNewsBoard as BoardDescriptor,
  "health-log-browser": healthLogBrowserBoard as BoardDescriptor,
  "meeting-poll-browser": meetingPollBrowserBoard as BoardDescriptor,
  notes: notesBoard as BoardDescriptor,
  // Its units disagree on which params they set, which JSON typing cannot
  // reconcile with UnitEntry's string record.
  "rss-radio": rssRadioBoard as unknown as BoardDescriptor,
  // The editor's fetch, read and brief steps for one article, to try them by
  // hand. Not in the catalog: it is a bench for the Radio, not an app.
  "rss-radio-brief-one": rssRadioBriefOneBoard as BoardDescriptor,
  "syn-mail-desk": synMailDeskBoard as BoardDescriptor,
};

/**
 * The units a composed demo is made of, keyed by the `uri` it names each one
 * with. A demo arrives at no URL, so there is nothing beside it to find them
 * at: they travel with it, as a restored draft's do.
 */
const UNITS: Record<string, Record<string, BoardDescriptor>> = {
  "rss-radio": {
    "rss-demo-board.json": rssAggregatorBoard as BoardDescriptor,
    "rss-radio-editor-unit-board.json": rssRadioEditorUnit as BoardDescriptor,
    "rss-radio-voice-unit-board.json": rssRadioVoiceUnit as BoardDescriptor,
    "rss-radio-unit-board.json": rssRadioUnit as BoardDescriptor,
    "rss-radio-library-unit-board.json": rssRadioLibraryUnit as BoardDescriptor,
  },
  "syn-mail-desk": {
    "syn-booking-unit-board.json": synBookingUnit as BoardDescriptor,
    "syn-hotels-unit-board.json": synHotelsUnit as BoardDescriptor,
    "syn-mail-desk-unit-board.json": synMailDeskUnit as BoardDescriptor,
  },
};

export function findDemoBoard(slug: string): BoardDescriptor | undefined {
  return REGISTRY[slug.toLowerCase()];
}

export function findDemoUnits(
  slug: string,
): Record<string, BoardDescriptor> | undefined {
  return UNITS[slug.toLowerCase()];
}
