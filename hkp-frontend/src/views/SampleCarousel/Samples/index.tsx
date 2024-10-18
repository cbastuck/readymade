import { game } from "./Game";
import { monitoring } from "./Monitoring";
import { send } from "./TextSend";
import { midi } from "./MidiController";
import { spotify2Github } from "./SpotifyToGithub";
import { CarouselItem } from "..";

export const carouselItems: Array<CarouselItem> = [
  game,
  monitoring,
  send,
  midi,
  spotify2Github,
];

export function capitaliseHeadline(headline: string): string {
  return headline
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
