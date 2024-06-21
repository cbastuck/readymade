import { useEffect } from "react";

import anime from "../../anime";

import "./ClaimApp.css";

export default function ClaimApp() {
  useEffect(() => {
    anime({
      targets: document.querySelectorAll("#hkp-claim-app"),
      loop: false,
      direction: "forward",
      opacity: ["0%", "100%"],
      easing: "easeInOutSine",
      duration: 2000,
      delay: 4000,
    });
  }, []);

  return (
    <div id="hkp-claim-app" className="pt-1">
      <div className="flex items-end justify-center">
        <div className="text-xl md:text-base whitespace-nowrap text-sky-600">
          hookup
          <span className="claim-color-change pl-1">idea</span>
          <span className="claim-color-change px-[2px]">&</span>
          <span className="claim-color-change">inspiration</span>
        </div>
      </div>
    </div>
  );
}
