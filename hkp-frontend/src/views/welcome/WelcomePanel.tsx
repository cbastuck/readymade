import { useCallback, useEffect, useState } from "react";

import { useNavigate } from "react-router-dom";

import ClaimApp from "./ClaimApp";

import { carouselItems } from "hkp-frontend/src/views/SampleCarousel/Samples";

import HookupLogo from "./HookupLogo";
import WelcomeWord from "./WelcomeWord";
import LandingPitch from "./LandingPitch";
import SampleCarousel, { CarouselItem } from "../SampleCarousel";
import { WelcomeHeroVideo } from "./WelcomeHeroVideo";
import { currentHeroVideo } from "./heroVideos";
import SampleBoards from "../docs/SampleBoards";

export const welcomeBlockClassname =
  "flex flex-col mb-4 text-lg overflow-hidden tracking-widest text-left mx-auto w-[100%] md:w-[85%] md:max-w-[800px] gap-4";

export default function WelcomePanel() {
  const navigate = useNavigate();

  const [headerAnimationsComplete, setHeaderAnimationsComplete] =
    useState(false);

  const forceCompleteAnimation = useCallback(
    () => setHeaderAnimationsComplete(true),
    []
  );

  const onLandingPitchComplete = useCallback(
    () => setHeaderAnimationsComplete(true),
    []
  );

  const onLoadBoard = (item: CarouselItem) =>
    headerAnimationsComplete &&
    item.action?.onClick?.url &&
    navigate(item.action?.onClick?.url);

  const [currentCarouselItem, setCurrentCarouselItem] = useState(0);
  const video = currentHeroVideo();

  const [sampleAppsVisible, setSampleAppsVisible] = useState(false);
  useEffect(() => {
    const to = setTimeout(() => {
      setSampleAppsVisible(true);
    }, 1000);
    return () => clearTimeout(to);
  }, []);

  return (
    <div
      className="flex flex-col w-full mt-0 md:mt-[5%]"
      onClick={forceCompleteAnimation}
    >
      <div className="flex flex-col">
        <WelcomeHeroVideo value={video}>
          <div className="px-[10px] w-full flex mt-[50px]">
            <WelcomeWord
              heroVideo={video}
              noAnimation={headerAnimationsComplete}
            />{" "}
          </div>
          <div className="mb-4 mt-3">
            <h1 className="w-full ml-auto md:text-center">
              <ClaimApp
                claim={video.claim}
                heroVideo={video}
                noAnimation={headerAnimationsComplete}
              />
            </h1>
          </div>

          <div className="mt-4">
            <LandingPitch
              heroVideo={video}
              usecases={carouselItems}
              switchUsecaseInterval={5000}
              onComplete={onLandingPitchComplete}
              onLink={setCurrentCarouselItem}
              noAnimation={headerAnimationsComplete}
            />
          </div>
          <div className="mb-8 mt-4">
            <HookupLogo
              heroVideo={video}
              noAnimation={headerAnimationsComplete}
            />
          </div>
        </WelcomeHeroVideo>
      </div>

      <div
        className="px-10 pt-10"
        style={{
          maxHeight: sampleAppsVisible ? undefined : 530, // this show the scrollbar by default, but does not scroll much and avoids horiontal jumping when scrollbar comes in
          opacity: sampleAppsVisible ? 1 : 0,
          transition: "opacity 2s ease",
          overflowY: "hidden",
        }}
      >
        <h1 id="samples" className="pt-4 md:pt-10 m-0 md:text-center">
          Example Apps
        </h1>
        <SampleCarousel
          background={video.still} //"/assets/heros/pexels-steve-1495321%20md.jpg" //"/assets/teaser/blue3.png"
          current={currentCarouselItem}
          onLoad={onLoadBoard}
          onCurrentChange={setCurrentCarouselItem}
        />
      </div>

      <div
        className={`pb-20 px-10 mx-auto font-menu ${welcomeBlockClassname}`}
        style={{
          opacity: sampleAppsVisible ? 1 : 0,
          transition: "opacity 2s ease",
        }}
      >
        <h1 id="samples" className="md:pt-10 m-0 md:text-center">
          All Demo Apps
        </h1>
        <div className="px-4">
          <SampleBoards headline="" hideDate />
        </div>
      </div>
    </div>
  );
}
