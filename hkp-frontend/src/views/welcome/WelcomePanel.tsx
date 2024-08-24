import { useState } from "react";

import { useNavigate } from "react-router-dom";

import ClaimApp from "./ClaimApp";
import { CarouselItem } from "@/ui-components/Carousel";
import { carouselItems } from "@/views/sampleBoards/Samples";

import HookupLogo from "./HookupLogo";
import WelcomeWord from "./WelcomeWord";
import LandingPitch from "./LandingPitch";
import SampleBoards from "../sampleBoards";

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
  return (
    <div
      className="flex flex-col w-full mt-[5%]"
      onClick={forceCompleteAnimation}
    >
      <div className="flex flex-col ">
        <div className="px-[10px] w-full flex mt-[50px]">
          <h1 className="w-full ml-auto md:text-center">
            <WelcomeWord noAnimation={headerAnimationsComplete} />{" "}
            <ClaimApp noAnimation={headerAnimationsComplete} />
          </h1>
        </div>

        <HookupLogo noAnimation={headerAnimationsComplete} />

        <LandingPitch
          usecases={carouselItems}
          switchUsecaseInterval={5000}
          onComplete={() => setHeaderAnimationsComplete(true)}
          onLink={setCurrentCarouselItem}
          noAnimation={headerAnimationsComplete}
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
        <SampleBoards
          onLoad={onLoadBoard}
          current={currentCarouselItem}
          onCurrentChange={setCurrentCarouselItem}
        />
      </div>
    </div>
  );
}
