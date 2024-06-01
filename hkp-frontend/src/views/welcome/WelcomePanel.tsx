import { useState } from "react";
import { useNavigate } from "react-router-dom";

import WhatsNew from "./WhatsNew";
import Carousel, { CarouselItem } from "@/ui-components/Carousel";
import Sandbox from "@/Sandbox";
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
      title: "A quick game idea with HookitApp",
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
        <div className="flex flex-col gap-4 justify-center mx-10 drop-shadow-3xl">
          <Sandbox
            src="/assets/teaser/hkp-board-peer-sender.json"
            hidePlaygroundLink={false}
          />

          <Sandbox
            src="/assets/teaser/hkp-board-peer-receiver.json"
            hidePlaygroundLink={false}
          />
        </div>
      ),
      title: "Hookup two devices via peer sockets (try it out)",
      background: "/assets/teaser/sky-small2.png",
    },
  ];

  return (
    <div
      className="flex flex-col w-full mt-[5%]"
      onClick={forceCompleteAnimation}
    >
      <div className="flex flex-col ">
        <div className="px-[10px] w-full flex mt-[50px]">
          <h1 className="w-full ml-auto">
            <WelcomeWord /> <WhatsNew />
          </h1>
        </div>
        <div className="w-[12%] min-w-[70px] mx-auto mb-10">
          <HookupLogo />
        </div>

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
        <h1 className="pt-10 m-0 text-center">Videos and Demos</h1>
        <div className="mx-auto px-10 pb-10">
          <Carousel items={carouselItems} />
        </div>

        <h1 className="pt-10 m-0 text-center">About Hookitapp</h1>
        <BackgroundSection />
      </div>
    </div>
  );
}
