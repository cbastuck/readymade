import { CarouselItem } from "@/ui-components/Carousel";

import { game } from "./Game";
import { monitoring } from "./Monitoring";
import { send } from "./TextSend";
import { midi } from "./MidiController";
import { spotify2Github } from "./SpotifyToGithub";

export const carouselItems: Array<CarouselItem> = [
  game,
  monitoring,
  send,
  midi,
  spotify2Github,
];
