import { useState } from "react";

import { useNavigate } from "react-router-dom";

import ClaimApp from "./ClaimApp";
import Carousel, { CarouselItem } from "@/ui-components/Carousel";

import HookupLogo from "./HookupLogo";
import WelcomeWord from "./WelcomeWord";
import LandingPitch from "./LandingPitch";
import Faq from "./Faq";
import { carouselItems } from "./Samples";

export default function WelcomePanel() {
  const [headerAnimationsComplete, setHeaderAnimationsComplete] =
    useState(false);
  const forceCompleteAnimation = () => setHeaderAnimationsComplete(true);

  const navigate = useNavigate();
  const onClick = (item: CarouselItem) =>
    headerAnimationsComplete &&
    item.action?.onClick?.url &&
    navigate(item.action?.onClick?.url);

  const [currentCarouselItem, setCurrentCarouselItem] = useState(0);
  return (
    <div
      className="flex flex-col w-full mt-[5%]"
      onClick={forceCompleteAnimation}
    >
      <div className="flex flex-col ">
        <div className="px-[10px] w-full flex mt-[50px]">
          <h1 className="w-full ml-auto md:text-center">
            <WelcomeWord /> <ClaimApp />
          </h1>
        </div>

        <HookupLogo />

        <LandingPitch
          usecases={carouselItems}
          switchUsecaseInterval={5000}
          onComplete={() => setHeaderAnimationsComplete(true)}
          onLink={(idx) => setCurrentCarouselItem(idx)}
        />
      </div>

      <div
        style={{
          maxHeight: headerAnimationsComplete ? undefined : 530, // this show the scrollbar by default, but does not scroll much and avoids horiontal jumping when scrollbar comes in
          opacity: headerAnimationsComplete ? 1 : 0,
          transition: "opacity 2s ease",
          overflowY: "hidden",
        }}
      >
        <h1 id="samples" className="pt-4 md:pt-10 m-0 md:text-center">
          Sample Boards
        </h1>
        <div className="py-10 text-xl overflow-hidden tracking-widest text-justify mx-auto sm:w-[100%] md:w-[70%] gap-4">
          Get a quick impression what this means by browsing through the
          samples. Maybe it is something you tried in the past as well? Every
          sample comes with a video with a link to the Playground, so can
          directly jump into the experience and try or tweak it yourself.
        </div>

        <div className="mx-auto px-[0%] lg:px-[10%] pb-6">
          <Carousel
            items={carouselItems}
            current={currentCarouselItem}
            onChange={setCurrentCarouselItem}
            onClick={onClick}
          />
          <div className="text-xl overflow-hidden tracking-widest text-justify mx-auto sm:w-[100%] md:w-[80%] gap-4 mt-2">
            {carouselItems[currentCarouselItem].description}
          </div>
        </div>

        <div className="pb-14">
          <Faq />
        </div>
      </div>
    </div>
  );
}
