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
  description: (
    <div>
      <div>
        The video shows a minimal version of a game inspired by Pong, but with
        only one paddle. A ball bounces back from each border as well as the
        single paddle. You control the paddle using the XY pad in the first
        runtime.
      </div>
      <div>
        Just grab your mobile phone and scan the QR code at the bottom of the
        board. This opens a single runtime board that is connected to the game
        running on the other device. With the XY pad on the phone, you control
        the paddle in the same way you controlled it from the runtime on the
        same device.
      </div>
    </div>
  ),
  background: "/assets/teaser/blue3.png",
  action: {
    title: "Click to open",
    onClick: {
      url: "/playground?template=https://raw.githubusercontent.com/cbastuck/hkp/master/usecases/game.json&sender-board=%random-name%",
    },
  },
};
