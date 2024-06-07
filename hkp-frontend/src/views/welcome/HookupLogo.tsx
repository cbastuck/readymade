import { useEffect } from "react";
import anime from "./anime";

//import Logo from "@/assets/animations/AnimatedLogo3.svg?react";
import Logo from "@/assets/animations/AnimatedLogo6.svg?react";

type Props = {
  initialDelay?: number;
};
export default function HookupLogo({ initialDelay = 3000 }: Props) {
  useEffect(() => {
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
    });

    anime({
      targets: document.querySelectorAll("#hkp-logo"),
      loop: false,
      direction: "forward",
      opacity: ["0%", "100%"],
      easing: "easeInOutSine",
      duration: 2000,
      delay: 2500,
    });
  }, []);

  return (
    <div
      id="hkp-logo"
      className="mt-[10px] stroke-blue-600 stroke-[0.2] px-[8%] pt-[5%]  pb-2 stroke-white rounded-full stroke-[0.5] border border-solid border-gray-300 bg-gradient-to-r from-sky-600 to-sky-400 drop-shadow "
    >
      <Logo />
    </div>
  );
}
