import { CarouselItem } from "@/ui-components/Carousel";
import { capitaliseHeadline } from ".";

const headline = "use your phone to control things on another device";

export const game: CarouselItem = {
  videoUrl: "/assets/teaser/GameTeaser.mp4",
  headline,
  title: `Sample 1: ${capitaliseHeadline(headline)}`,
  description: (
    <div className="flex flex-col gap-4">
      <div>
        The video demonstrates a minimal version of a game inspired by Pong, but
        with only one paddle. The ball bounces off each border as well as the
        single paddle. You control the paddle using the XY Pad in the first
        runtime.
      </div>
      <div>
        Just grab your mobile phone and scan the QR code at the bottom of the
        board. This opens a single runtime board connected to the game running
        on another device. Using the XY Pad on your phone, you can control the
        paddle in the same way you did from the runtime on the same device.
      </div>
    </div>
  ),
  background: "/assets/teaser/blue3.png",
  action: {
    title: "Open in Playground",
    onClick: {
      url: "/playground?template=https://raw.githubusercontent.com/cbastuck/hkp/master/usecases/game.json&sender-board=%random-name%",
    },
  },
};
