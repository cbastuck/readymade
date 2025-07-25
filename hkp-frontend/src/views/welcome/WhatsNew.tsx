import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { useEffect } from "react";
import anime from "../../anime";

import { Button } from "hkp-frontend/src/ui-components/primitives/button";

import "./UpdatesButton.css";

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
      <Link
        className="hover:no-underline flex items-end justify-center"
        to="/docs/updates"
      >
        <div className="text-base whitespace-nowrap">what's new?</div>
        <Button variant="minimal" size="icon" className="h-min w-min">
          <Star strokeWidth={1} />
        </Button>
      </Link>
    </div>
  );
}
