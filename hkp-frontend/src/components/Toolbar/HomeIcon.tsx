import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

import IconH from "./assets/hkp-single-dot-h.svg?react";

export default function HomeIcon() {
  const size = 24;
  return (
    <Button
      variant="ghost"
      className="pt-[12px] pl-[4px] ml-[4px] mr-[1px] pr-1 hover:drop-shadow-2xl"
    >
      <Link to="/">
        <div className="px-[8px]">
          <IconH
            className="stroke-[#333] hover:stroke-sky-600"
            width={size}
            height={size}
          />
        </div>
      </Link>
    </Button>
  );
}
