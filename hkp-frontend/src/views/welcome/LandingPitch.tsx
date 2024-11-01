import { useEffect, useRef, useState } from "react";
import anime from "@/anime";
import Switcher from "@/components/Switcher";
import { welcomeBlockClassname } from "./WelcomePanel";
import { HeroVideoDescriptor } from "./heroVideos";

export type LandingPitchUsecase = { headline?: string };
type Props = {
  usecases: Array<LandingPitchUsecase>;
  switchUsecaseInterval: number;
  noAnimation?: boolean;
  heroVideo: HeroVideoDescriptor;
  onComplete: () => void;
  onLink: (idx: number) => void;
};

export default function LandingPitch({
  usecases,
  switchUsecaseInterval,
  noAnimation,
  heroVideo,
  onComplete,
  onLink,
}: Props) {
  const animationInstance = useRef<any>(null);

  useEffect(() => {
    if (animationInstance.current && noAnimation) {
      animationInstance.current.seek(9000); // seek to the end of the animation
      setOpacity("opacity-100");
    }
  }, [noAnimation]);

  useEffect(() => {
    const initialDelay = 4000;
    animationInstance.current = anime({
      targets: document.querySelectorAll("#pitch-points .pitch-item"),
      loop: false,
      direction: "forward",
      translateY: [1000, 0],
      easing: "easeInOutSine",
      duration: 1000,
      delay: (_el: any, i: number) => {
        if (i === 0) {
          return initialDelay;
        }
        return i * 1000 + initialDelay;
      },
      complete: onComplete,
    });
  }, []);

  useEffect(() => {
    setTimeout(() => setOpacity("opacity-100"), 4000);
  }, []);
  const [opacity, setOpacity] = useState("opacity-0");

  return (
    <div id="pitch-points" className={`${welcomeBlockClassname}`}>
      <div
        className={`flex flex-col py-4 gap-2 bg-[#FFFFFFF5] rounded border border-gray-200 transition-opacity ease-in duration-700 ${opacity} `}
      >
        <div className={`pitch-item ${heroVideo.landingPitchTextStyle}`}>
          Do you sometimes feel creative, but setting everything up destroys the
          inspiration? Maybe you just want to connect two or more things, like{" "}
          <Switcher
            animate={true}
            style={{}}
            duration={switchUsecaseInterval}
            data={usecases.map(({ headline }) => headline || "")}
            onLink={onLink}
            suffix="?"
          />
        </div>
        <div className={`pitch-item ${heroVideo.landingPitchTextStyle}`}>
          Then this might be for you. Focus on the idea, and how to compose it.
          Do not think to much about underlying connections.
        </div>
        <div className={`pitch-item ${heroVideo.landingPitchTextStyle}`}>
          Orchestrate ideas with data seamlessly flowing through services
          regardless of their location or platform. Manage everything from one
          Board.
        </div>
      </div>
    </div>
  );
}
