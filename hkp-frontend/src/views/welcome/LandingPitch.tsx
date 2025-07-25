import { useEffect, useRef, useState } from "react";
import anime from "hkp-frontend/src/anime";
import Switcher from "hkp-frontend/src/components/Switcher";
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
  }, [onComplete]);

  useEffect(() => {
    setTimeout(() => setOpacity("opacity-100"), 4000);
  }, []);
  const [opacity, setOpacity] = useState("opacity-0");
  return (
    <div id="pitch-points" className="w-full">
      <div
        className={`py-4 bg-[#FFFFFFE0] transition-opacity ease-in duration-700 ${opacity} `}
      >
        <div className="w-[50%] mx-auto flex flex-col gap-4">
          <div
            className={`pitch-item ${heroVideo.landingPitchTextStyle} min-h-[72px] 2lg:min-h-0`}
          >
            Feeling creative but lose inspiration during setup? You want to
            connect devices effortlessly, like{" "}
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
            Build tools that bring ideas to life, not just connections.
          </div>
          <div className={`pitch-item ${heroVideo.landingPitchTextStyle}`}>
            Seamlessly connect data and sevices across platforms. Manage all
            from one Board.
          </div>
        </div>
      </div>
    </div>
  );
}
