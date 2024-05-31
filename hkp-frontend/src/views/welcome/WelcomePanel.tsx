import WhatsNew from "./WhatsNew";
import Carousel from "@/ui-components/Carousel";

import { useNavigate } from "react-router-dom";
import Button from "@/ui-components/Button";

import Sandbox from "@/Sandbox";
import HookupLogo from "./HookupLogo";
import WelcomeWord from "./WelcomeWord";
import LandingPitch from "./LandingPitch";
import { useState } from "react";

const teaserVideos = ["/assets/teaser/GameTeaser.mp4"];
const carouselItems = teaserVideos
  .map((video) => ({
    element: (
      <video
        className="rounded-xl border-solid border mx-auto drop-shadow-3xl"
        src={video}
        autoPlay
        loop
        width="85%"
      />
    ),
    title: "A quick game idea with Hookitapp",
  }))
  .concat({
    element: (
      <div className="flex justify-center mx-10 bg-white rounded-xl border-solid border drop-shadow-3xl">
        <Sandbox src="/assets/teaser/board.json" hidePlaygroundLink={true} />
      </div>
    ),
    title: "Try it out",
  });

export default function WelcomePanel() {
  const navigate = useNavigate();

  const [headerAnimationsComplete, setHeaderAnimationsComplete] =
    useState(false);
  return (
    <div className="flex flex-col w-full mt-[5%]">
      <div className="flex flex-col ">
        <div className="px-[100px] w-full flex mt-[50px]">
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
        className="flex gap-0.5 mx-auto mt-1 w-[60%]"
        style={{ display: "none" }}
      >
        <Button className="w-full" onClick={() => navigate("/welcome/mission")}>
          What is this?
        </Button>

        <Button className="w-full" onClick={() => navigate("/engage")}>
          I want to engage
        </Button>
      </div>

      <div
        style={{
          opacity: headerAnimationsComplete ? 1 : 0,
          transition: "opacity 2s ease",
        }}
      >
        <h2 className="pt-10 m-0">Videos and Demos</h2>
        <div className="mx-auto px-10 pb-10">
          <Carousel items={carouselItems} />
        </div>
      </div>
    </div>
  );
}
