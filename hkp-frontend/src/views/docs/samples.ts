import { v4 as uuidv4 } from "uuid";

import examplesData from "../examples/ExamplesData";
import { game } from "../SampleCarousel/Samples/Game";
import { SavedBoard } from "hkp-frontend/src/types";
import { midi } from "../SampleCarousel/Samples/MidiController";
import { monitoring } from "../SampleCarousel/Samples/Monitoring";
import { spotify2Github } from "../SampleCarousel/Samples/SpotifyToGithub";
import { send } from "../SampleCarousel/Samples/TextSend";
import { receive } from "../SampleCarousel/Samples/TextReceive";

const samples: Array<SavedBoard> = [
  {
    id: uuidv4(),
    url: game.boardUrl,
    description: game.headline,
    value: {} as any, // TODO: fix this
    name: "Game",
    createdAt: game.createdAt,
  },
  {
    id: uuidv4(),
    url: midi.boardUrl,
    description: midi.headline,
    value: {} as any, // TODO: fix this
    name: "Midi Controller",
    createdAt: midi.createdAt,
  },
  {
    id: uuidv4(),
    url: monitoring.boardUrl,
    description: monitoring.headline,
    value: {} as any, // TODO: fix this
    name: "Monitoring",
    createdAt: monitoring.createdAt,
  },
  {
    id: uuidv4(),
    url: spotify2Github.boardUrl,
    description: spotify2Github.headline,
    value: {} as any, // TODO: fix this
    name: "Spotify2Github",
    createdAt: spotify2Github.createdAt,
  },
  {
    id: uuidv4(),
    url: receive.boardUrl,
    description: receive.headline,
    value: {} as any, // TODO: fix this
    name: "Receive Encrypted Text",
    createdAt: receive.createdAt,
  },
  {
    id: uuidv4(),
    url: send.boardUrl,
    description: send.headline,
    value: {} as any, // TODO: fix this
    name: "Send Encrypted Text",
    createdAt: send.createdAt,
  },
];

const legacyExamples: Array<SavedBoard> = examplesData.map((item) => ({
  id: uuidv4(),
  url: `/playground/${item.title}?src=${item.url}`,
  description: item.brief,
  value: {} as any, // TODO: fix this
  name: item.title,
  createdAt: item.createdAt,
}));

export default [...samples, ...legacyExamples];
