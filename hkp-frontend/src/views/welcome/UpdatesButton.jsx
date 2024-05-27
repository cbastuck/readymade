import { Link } from "react-router-dom";
import { Star } from "lucide-react";

import { Button } from "@/ui-components/primitives/button";

import "./UpdatesButton.css";

export default function UpdatesButton() {
  return (
    <Link
      className="hover:no-underline flex items-end justify-center"
      to="/docs/updates"
    >
      <div className="text-base whitespace-nowrap">what's new?</div>
      <Button variant="minimal" size="icon" className="h-min w-min">
        <Star strokeWidth={1} />
      </Button>
    </Link>
  );
}
