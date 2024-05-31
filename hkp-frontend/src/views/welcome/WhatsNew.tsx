import { useEffect } from "react";
import anime from "./anime";

import UpdatesButton from "./UpdatesButton";

export default function WhatsNew() {
  useEffect(() => {
    anime({
      targets: document.querySelectorAll("#hkp-whats-new"),
      loop: false,
      direction: "forward",
      opacity: ["0%", "100%"],
      easing: "easeInOutSine",
      duration: 2000,
      delay: 4000,
    });
  }, []);

  return (
    <div id="hkp-whats-new">
      <UpdatesButton />
    </div>
  );
}
