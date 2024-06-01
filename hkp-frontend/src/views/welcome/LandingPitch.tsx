import { useEffect } from "react";
import anime from "./anime";

type Props = {
  onComplete: () => void;
};
export default function LandingPitch({ onComplete }: Props) {
  useEffect(() => {
    const initialDelay = 4000;
    anime({
      targets: document.querySelectorAll("#pitch-points div"),
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
    <div
      id="pitch-points"
      className="flex flex-col mb-10 text-xl overflow-hidden tracking-widest text-center mx-auto w-[50%] gap-4"
    >
      <div>
        Ever felt creative, but the setup process kills your inspiration?
      </div>
      <div>
        Imagine focusing on your ideas instead of dealing with technical setup.
      </div>
      <div>
        HookitApp: Build ideas with data flowing through reusable building
        blocks.
      </div>
    </div>
  );
}
