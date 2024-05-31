import { useEffect, useState } from "react";
import anime from "./anime";

import WelcomeWordSVG from "@/assets/animations/WelcomeWord2.svg?react";
import WelcomeWordFatSVG from "@/assets/animations/WelcomeWordFat2.svg?react";

export default function Welcome() {
  const [isComplete, setIsComplete] = useState(false);
  useEffect(() => {
    anime({
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
    <div id="hkp-welcome" className="w-[30%] min-w-[200px] mx-auto">
      <div
        style={{ opacity: isComplete ? 0 : 1, transition: "opacity 2s ease" }}
      >
        <WelcomeWordSVG />
      </div>
      <div
        style={{
          marginTop: "-23%",
          opacity: isComplete ? 1 : 0,
          transition: "opacity 5s ease",
        }}
      >
        <WelcomeWordFatSVG />
      </div>
    </div>
  );
}
