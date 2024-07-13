import { CarouselItem } from "@/ui-components/Carousel";

const headline = "share a file without a detour via the cloud";

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
  description: <div>Peer to peer connection to the other device</div>,
  background: "/assets/teaser/blue3.png",
  action: {
    title: "Click to open",
    onClick: {
      url: "/playground",
    },
  },
};
