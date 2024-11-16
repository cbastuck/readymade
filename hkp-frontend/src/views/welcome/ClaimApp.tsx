import { useEffect, useRef } from "react";

import anime from "../../anime";

import "./ClaimApp.css";
import { HeroVideoDescriptor } from "./heroVideos";

type Props = {
  claim: string;
  noAnimation?: boolean;
  heroVideo: HeroVideoDescriptor;
};

export default function ClaimApp({ noAnimation, heroVideo, claim }: Props) {
  const animationInstance = useRef<any>(null);

  useEffect(() => {
    if (animationInstance.current && noAnimation) {
      animationInstance.current.seek(9000); // seek to the end of the animation
    }
  }, [noAnimation]);

  useEffect(() => {
    animationInstance.current = anime({
      targets: document.querySelectorAll("#hkp-claim-app"),
      loop: false,
      direction: "forward",
      opacity: ["0%", "100%"],
      easing: "easeInOutSine",
      duration: 2000,
      delay: 4000,
    });
  }, []);

  const textColor = heroVideo.claimTextStyle || "text-sky-600";

  return (
    <div id="hkp-claim-app">
      <div className="flex items-end justify-center">
        <div className={`text-base whitespace-nowrap ${textColor}`}>
          Hookitapp -<span className="pl-1">{claim}</span>
        </div>
      </div>
    </div>
  );
}
