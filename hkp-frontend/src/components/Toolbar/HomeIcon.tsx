import { Link } from "react-router-dom";

import { Button } from "hkp-frontend/src/ui-components/primitives/button";

import IconH from "hkp-frontend/src/components/Toolbar/assets/hkp-single-dot-h.svg?react";

export default function HomeIcon() {
  const size = 24;
  return (
    <Button
      variant="ghost"
      className="pl-[4px] ml-[4px] mr-[0px] pr-0 hover:drop-shadow-2xl"
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
