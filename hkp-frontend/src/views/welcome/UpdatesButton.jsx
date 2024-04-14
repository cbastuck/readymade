import { Link } from "react-router-dom";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";

import "./UpdatesButton.css";

export default function UpdatesButton() {
  return (
    <div className="font-sans" style={{ marginLeft: "250px" }}>
      <Link to="/docs/updates" className="hover:no-underline">
        <Button variant="minimal" size="icon" className="h-min">
          <Star strokeWidth={1} />
        </Button>
        <div>what's new?</div>
      </Link>
    </div>
  );
}
