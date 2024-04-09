import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

import IconH from "./assets/hkp-single-dot-h.svg?react";

export default function HomeIcon() {
  return (
    <Button
      variant="ghost"
      className="pt-[12px] pl-[4px] ml-[4px] mr-[1px] pr-1"
    >
      <Link to="/">
        <div className="p-[2px]">
          <IconH width="22px" />
        </div>
      </Link>
    </Button>
  );
}
