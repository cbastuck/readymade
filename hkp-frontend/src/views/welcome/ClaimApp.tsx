import { useEffect } from "react";

import anime from "./anime";

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
    <div id="hkp-claim-app">
      <div className="flex items-end justify-center">
        <div className="text-base whitespace-nowrap text-sky-600">
          connect
          <span className="claim-color-change">•idea•</span>
          inspiration
        </div>
      </div>
    </div>
  );
}
