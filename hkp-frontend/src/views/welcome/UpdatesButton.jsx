import { Link } from "react-router-dom";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";

import "./UpdatesButton.css";

export default function UpdatesButton() {
  return (
    <div
      style={{
        marginLeft: "250px",
      }}
    >
      <Link to="/docs/updates">
        <Button variant="ghost" size="icon">
          <Star strokeWidth={1} />
        </Button>
        <div>what's new?</div>
      </Link>
    </div>
  );
}
