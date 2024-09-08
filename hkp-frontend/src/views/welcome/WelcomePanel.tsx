import { useState } from "react";

import { useNavigate } from "react-router-dom";

import ClaimApp from "./ClaimApp";
import { CarouselItem } from "@/ui-components/Carousel";
import { carouselItems } from "@/views/sampleBoards/Samples";

import HookupLogo from "./HookupLogo";
import WelcomeWord from "./WelcomeWord";
import LandingPitch from "./LandingPitch";
import SampleBoards from "../sampleBoards";
import { WelcomeHeroVideo } from "./WelcomeHeroVideo";
import { currentHeroVideo } from "./heroVideos";

export const welcomeBlockClassname =
  "flex flex-col mb-10 text-xl overflow-hidden tracking-widest text-left mx-auto w-[100%] md:w-[70%] md:max-w-[800px] gap-4";
export default function WelcomePanel() {
  const navigate = useNavigate();

  const [headerAnimationsComplete, setHeaderAnimationsComplete] =
    useState(false);

  const forceCompleteAnimation = () => setHeaderAnimationsComplete(true);

  const onLoadBoard = (item: CarouselItem) =>
    headerAnimationsComplete &&
    item.action?.onClick?.url &&
    navigate(item.action?.onClick?.url);

  const [currentCarouselItem, setCurrentCarouselItem] = useState(0);
  const video = currentHeroVideo();
  return (
    <div
      className="flex flex-col w-full mt-[5%]"
      onClick={forceCompleteAnimation}
    >
      <div className="flex flex-col">
        <WelcomeHeroVideo value={video}>
          <div className="px-[10px] w-full flex mt-[50px]">
            <h1 className="w-full ml-auto md:text-center">
              <WelcomeWord
                heroVideo={video}
                noAnimation={headerAnimationsComplete}
              />{" "}
              <ClaimApp
                heroVideo={video}
                noAnimation={headerAnimationsComplete}
              />
            </h1>
          </div>

          <HookupLogo
            heroVideo={video}
            noAnimation={headerAnimationsComplete}
          />

          <div className="px-10">
            <LandingPitch
              heroVideo={video}
              usecases={carouselItems}
              switchUsecaseInterval={5000}
              onComplete={() => setHeaderAnimationsComplete(true)}
              onLink={setCurrentCarouselItem}
              noAnimation={headerAnimationsComplete}
            />
          </div>
        </WelcomeHeroVideo>
      </div>

      <div
        className="px-10"
        style={{
          maxHeight: headerAnimationsComplete ? undefined : 530, // this show the scrollbar by default, but does not scroll much and avoids horiontal jumping when scrollbar comes in
          opacity: headerAnimationsComplete ? 1 : 0,
          transition: "opacity 2s ease",
          overflowY: "hidden",
        }}
      >
        <SampleBoards
          onLoad={onLoadBoard}
          current={currentCarouselItem}
          onCurrentChange={setCurrentCarouselItem}
        />
      </div>
    </div>
  );
}
