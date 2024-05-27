import { useEffect } from "react";
import anime from "./anime";

//import WelcomeTextSVG1 from "@/assets/animations/AnimatedLogo.svg?react";
import WelcomeTextSVG from "@/assets/animations/AnimatedLogo3.svg?react";
//import WelcomeTextSVG from "@/assets/animations/WelcomeText.svg?react";

export default function HookupLogo() {
  useEffect(() => {
    const svgPath = document.querySelectorAll("#hkp-logo path");
    anime({
      targets: svgPath,
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
    });
  }, []);

  return (
    <div
      id="hkp-logo"
      className="mt-[10px] stroke-blue-600 stroke-[0.2] px-[10%] pt-4 pb-2 stroke-white rounded-full stroke-[0.5] border border-solid border-gray-300 bg-gradient-to-r from-cyan-500 to-blue-500 drop-shadow"
    >
      <WelcomeTextSVG />
    </div>
  );
}
