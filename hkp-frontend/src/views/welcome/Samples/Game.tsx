import { CarouselItem } from "@/ui-components/Carousel";

const headline = "use your phone to control another device";
export const game: CarouselItem = {
  element: (
    <video
      className="rounded-xl border-solid border mx-auto drop-shadow-3xl"
      src="/assets/teaser/GameTeaser.mp4"
      autoPlay
      loop
      width="85%"
    />
  ),
  headline,
  title: `Sample 1: ${headline}`,
  description:
    "Here you can describe what the user should do when they click on the image",
  background: "/assets/teaser/blue3.png",
  action: {
    title: "Click to open",
    onClick: {
      url: "/playground?template=https://raw.githubusercontent.com/cbastuck/hkp/master/usecases/game.json&sender-board=%random-name%",
    },
  },
};
