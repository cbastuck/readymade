import { useState } from "react";
import { useNavigate } from "react-router-dom";

import ClaimApp from "./ClaimApp";
import Carousel, { CarouselItem } from "@/ui-components/Carousel";
import HookupLogo from "./HookupLogo";
import WelcomeWord from "./WelcomeWord";
import LandingPitch from "./LandingPitch";
import BackgroundSection from "./BackgroundSection";

export default function WelcomePanel() {
  const [headerAnimationsComplete, setHeaderAnimationsComplete] =
    useState(false);
  const forceCompleteAnimation = () => setHeaderAnimationsComplete(true);
  const navigate = useNavigate();
  const carouselItems: Array<CarouselItem> = [
    {
      element: (
        <video
          className="rounded-xl border-solid border mx-auto drop-shadow-3xl"
          src="/assets/teaser/GameTeaser.mp4"
          autoPlay
          loop
          width="85%"
        />
      ),
      title: "Hook up a quick pong game",
      description:
        "Here you can describe what the user should do when they click on the image",
      background: "/assets/teaser/blue3.png",
      action: {
        title: "Click to try it on Playground",
        onClick: () =>
          headerAnimationsComplete &&
          navigate(
            "/playground?template=https://raw.githubusercontent.com/cbastuck/hkp/master/usecases/game.json&sender-board=%random-name%"
          ),
      },
    },
    {
      element: (
        <div className="flex flex-col gap-4 justify-center mx-10 drop-shadow-3xl"></div>
      ),
      title: "Hookup two devices via peer sockets (try it out)",
      description: "Bla bla bla",
      background: "/assets/teaser/sky-small2.png",
    },
  ];

  const [currentCarouselItem, setCurrentCarouselItem] = useState(0);
  return (
    <div
      className="flex flex-col w-full mt-[5%]"
      onClick={forceCompleteAnimation}
    >
      <div className="flex flex-col ">
        <div className="px-[10px] w-full flex mt-[50px]">
          <h1 className="w-full ml-auto">
            <WelcomeWord /> <ClaimApp />
          </h1>
        </div>

        <HookupLogo />

        <LandingPitch onComplete={() => setHeaderAnimationsComplete(true)} />
      </div>

      <div
        style={{
          maxHeight: headerAnimationsComplete ? undefined : 530, // this show the scrollbar by default, but does not scroll much and avoids horiontal jumping when scrollbar comes in
          opacity: headerAnimationsComplete ? 1 : 0,
          transition: "opacity 2s ease",
          overflowY: "hidden",
        }}
      >
        <h1 className="pt-4 md:pt-10 m-0">Sample Boards</h1>
        <div className="mb-10 text-xl overflow-hidden tracking-widest sm:text-justify md:text-center mx-auto sm:w-[100%] md:w-[80%] gap-4">
          Click one of the following videos to jump into the playground and try
          it out.
        </div>

        <div className="mx-auto md:px-10 pb-10">
          <Carousel items={carouselItems} onChange={setCurrentCarouselItem} />
          <div className="text-xl overflow-hidden tracking-widest sm:text-justify md:text-center mx-auto sm:w-[100%] md:w-[80%] gap-4 mt-2">
            {carouselItems[currentCarouselItem].description}
          </div>
        </div>

        <h1 className="pt-4 md:pt-10 m-0">Background</h1>
        <BackgroundSection />
      </div>
    </div>
  );
}
