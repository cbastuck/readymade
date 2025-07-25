import { useEffect, useRef } from "react";
import anime from "../../anime";

import Logo from "hkp-frontend/src/assets/animations/AnimatedLogo6.svg?react";
import { HeroVideoDescriptor } from "./heroVideos";

type Props = {
  heroVideo: HeroVideoDescriptor;
  initialDelay?: number;
  noAnimation?: boolean;
};
export default function HookupLogo({
  noAnimation,
  heroVideo,
  initialDelay = 3000,
}: Props) {
  const animationInstances = useRef<[any, any] | null>(null);

  useEffect(() => {
    if (animationInstances.current && noAnimation) {
      animationInstances.current[0].tick(10000);
      animationInstances.current[1].tick(10000);
    }
  }, [noAnimation]);

  useEffect(() => {
    animationInstances.current = [
      anime({
        targets: document.querySelectorAll("#hkp-logo path"),
        loop: false,
        direction: "forward",
        strokeDashoffset: [anime.setDashoffset, 0],
        easing: "easeInOutSine",
        duration: 300,
        delay: (_el: any, i: number) => {
          if (i === 0) {
            return initialDelay;
          }
          if (i < 6) {
            return i * 250 + initialDelay;
          }
          return initialDelay + 6 * 250 + i * 10;
        },
      }),
      null,
    ];

    animationInstances.current[1] = anime({
      targets: document.querySelectorAll("#hkp-logo"),
      loop: false,
      direction: "forward",
      opacity: ["0%", "100%"],
      easing: "easeInOutSine",
      duration: 2000,
      delay: 2500,
    });
  }, [initialDelay]);

  return (
    <div className="w-[45%] md:w-[18%] max-w-[180px] min-w-[70px] mx-auto">
      <div
        id="hkp-logo"
        className={`px-[8%] pt-[5%] pb-2 rounded-full border border-solid border-gray-300 ${heroVideo.logoBackground} drop-shadow`}
      >
        <Logo />
      </div>
    </div>
  );
}
