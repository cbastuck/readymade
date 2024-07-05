import { useState } from "react";
import { useNavigate } from "react-router-dom";

import ClaimApp from "./ClaimApp";
import Carousel, { CarouselItem } from "@/ui-components/Carousel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/ui-components/primitives/accordion";
import HookupLogo from "./HookupLogo";
import WelcomeWord from "./WelcomeWord";
import LandingPitch, { LandingPitchUsecase } from "./LandingPitch";
import BackgroundSection from "./BackgroundSection";

export default function WelcomePanel() {
  const [headerAnimationsComplete, setHeaderAnimationsComplete] =
    useState(false);
  const forceCompleteAnimation = () => setHeaderAnimationsComplete(true);
  const navigate = useNavigate();
  const usecaseItems: Array<LandingPitchUsecase> = [
    {
      text: "use the phone as controller for a game on another device",
      link: "#samples",
    },
    {
      text: "monitor realtime data and render charts",
      link: "#samples",
    },
    { text: "connect two devices over the internet?", link: "#samples" },
    { text: "connect a spreadsheet and a website?", link: "#samples" },
    { text: "connect your local LLM with text output", link: "#samples" },
  ];
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
      title: `Sample 1: ${usecaseItems[0].text}`,
      description:
        "Here you can describe what the user should do when they click on the image",
      background: "/assets/teaser/blue3.png",
      action: {
        title: "Click to open",
        onClick: () =>
          headerAnimationsComplete &&
          navigate(
            "/playground?template=https://raw.githubusercontent.com/cbastuck/hkp/master/usecases/game.json&sender-board=%random-name%"
          ),
      },
    },
    {
      element: (
        <video
          className="rounded-xl border-solid border mx-auto drop-shadow-3xl"
          src="/assets/teaser/WikipediaMonitoring.mp4"
          autoPlay
          loop
          width="85%"
        />
      ),
      title: `Sample 2: ${usecaseItems[1].text}`,
      description:
        "Monitor incoming data and extract metric for rendering them in a graph",
      background: "/assets/teaser/sky-small2.png",
    },
    {
      element: (
        <div className="flex flex-col gap-4 justify-center mx-10 drop-shadow-3xl"></div>
      ),
      title: usecaseItems[2].text,
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
          <h1 className="w-full ml-auto md:text-center">
            <WelcomeWord /> <ClaimApp />
          </h1>
        </div>

        <HookupLogo />

        <LandingPitch
          usecases={usecaseItems}
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
        <div className="mb-10 text-xl overflow-hidden tracking-widest sm:text-justify md:text-center mx-auto sm:w-[100%] md:w-[80%] gap-4">
          Click one of the following videos to jump into the playground and try
          it out.
        </div>

        <div className="mx-auto px-[0%] lg:px-[10%] pb-6">
          <Carousel
            items={carouselItems}
            current={currentCarouselItem}
            onChange={setCurrentCarouselItem}
          />
          <div className="text-xl overflow-hidden tracking-widest sm:text-justify md:text-center mx-auto sm:w-[100%] md:w-[80%] gap-4 mt-2">
            {carouselItems[currentCarouselItem].description}
          </div>
        </div>

        <h1 className="pt-4 md:pt-10 mx-0 mb-2 md:text-center">Background</h1>
        <div className="mb-10 text-xl overflow-hidden tracking-widest text-justify mx-auto sm:w-[100%] md:w-[60%] gap-4">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="faq-1">
              <AccordionTrigger>What is this?</AccordionTrigger>
              <AccordionContent className="text-base font-serif">
                It's not so easy to describe. I often find similarities with
                existing tools and methodologies, but when looking deeper
                inside, think, na it's different - same but different.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="faq-2">
              <AccordionTrigger> Is it low-code?</AccordionTrigger>
              <AccordionContent className="text-base font-serif">
                Meh, I don't think replacing code is really an option. Further
                if I write a declarative configuration file, is it really so
                different from code? Also all the hype, the claims and the big
                promises are a big turn-off personally
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="faq-3">
              <AccordionTrigger>Is it visual programming?</AccordionTrigger>
              <AccordionContent className="text-base font-serif">
                Meh, yeah that's cool, but at the same time visual programming
                restricts yourself too much. Also boxes and arrows alone feel
                like the wrong abstraction. Like plastering you code with gotos.
                I'm missing the structure here. Abstraction that help
                composition that you understand in year after creation. Also the
                focus on visual stuff hinders in the end. This visual gimmicks
                are just cool in the beginning. But for maintainance you really
                just want some kind of configuration that is easy to read,
                merge, review, etc.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="faq-4">
              <AccordionTrigger>Is it rapid prototyping?</AccordionTrigger>
              <AccordionContent className="text-base font-serif">
                Yea, sort of. But at the same time the prototype could be enough
                to realise your personal ideas. It might provide real value.
                Then calling it a prototype is a bit of a turn off as it makes
                it sounds like a toy only
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="faq-5">
              <AccordionTrigger>
                Is a tool for connecting things?
              </AccordionTrigger>
              <AccordionContent className="text-base font-serif">
                Yeah, that's close. But it sounds too abstract for people to
                connect with it. The scope is top wide but the opposite effect
                should be achieved. To lower the access boundaries. Bridge the
                gap between being a user or a developer. It shouldn't be that
                black and white. There are many gray areas that are worth
                exploring for non CS folks
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
        <div className="pb-14">
          <BackgroundSection />
        </div>
      </div>
    </div>
  );
}
