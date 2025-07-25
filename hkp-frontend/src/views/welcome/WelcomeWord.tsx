import { useEffect, useRef, useState } from "react";
import anime from "../../anime";

import WelcomeWordSVG from "hkp-frontend/src/assets/animations/WelcomeWord2.svg?react";
import WelcomeWordFatSVG from "hkp-frontend/src/assets/animations/WelcomeWordFat2.svg?react";
import { HeroVideoDescriptor } from "./heroVideos";

type Props = {
  noAnimation?: boolean;
  heroVideo: HeroVideoDescriptor;
};
export default function Welcome({ noAnimation, heroVideo }: Props) {
  const [isComplete, setIsComplete] = useState(false);

  const animationInstance = useRef<any>(null);

  const welcomeDefaultStyle = "stroke-[rgb(74,141,203)] stroke-[4px]";

  useEffect(() => {
    if (animationInstance.current && noAnimation) {
      animationInstance.current.seek(10000); // seek to the end of the animation
    }
  }, [noAnimation]);

  useEffect(() => {
    animationInstance.current = anime({
      targets: document.querySelectorAll("#hkp-welcome path"),
      loop: false,
      direction: "forward",
      strokeDashoffset: [anime.setDashoffset, 0],
      easing: "easeInOutSine",
      duration: 300,
      delay: (_el: any, i: number) => {
        if (i === 0) {
          return 1000;
        }
        return i * 250 + 1000;
      },
      complete: () => setIsComplete(true),
    });
  }, []);

  return (
    <div id="hkp-welcome" className="w-[60%] md:w-[30%] min-w-[200px] mx-auto">
      <div
        style={{
          opacity: isComplete && !heroVideo.welcomeWordStyle ? 0 : 1,
          transition: "opacity 2s ease",
        }}
      >
        <WelcomeWordSVG
          className={heroVideo.welcomeWordStyle || welcomeDefaultStyle}
        />
      </div>
      {!heroVideo.welcomeWordStyle && (
        <div
          style={{
            marginTop: "-23%",
            opacity: isComplete ? 1 : 0,
            transition: "opacity 5s ease",
          }}
        >
          <WelcomeWordFatSVG />
        </div>
      )}
    </div>
  );
}
