import { useEffect, useRef } from "react";
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

  return (
    <div id="pitch-points" className={`${welcomeBlockClassname}`}>
      <div className={`pitch-item ${heroVideo.landingPitchTextStyle}`}>
        Do you sometimes feel creative, but the setup process destroys the
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
        Then this might be for you. Focus on the ideas, how to compose them and
        the intended output. Don't bother about underlying connections.
      </div>
      <div className={`pitch-item ${heroVideo.landingPitchTextStyle}`}>
        Orchestrate ideas with data seamlessly flowing through services
        regardless of location or environment. All happens on one Board.
      </div>
    </div>
  );
}
