import { CarouselItem } from "@/ui-components/Carousel";

import { game } from "./Game";
import { monitoring } from "./Monitoring";
import { send } from "./TextSend";
import { midi } from "./MidiController";

export const carouselItems: Array<CarouselItem> = [
  game,
  monitoring,
  send,
  midi,
];
