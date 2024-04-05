import { Link } from "react-router-dom";

import IconH from "./assets/hkp-single-dot-h.svg?react";

export default function HomeIcon() {
  const IconSvg = IconH;
  return (
    <div className="pt-[7px] pl-[1px] ml-[4px] mr-[1px]">
      <Link to="/">
        <div className="p-[2px]">
          <IconSvg width="22px" />
        </div>
      </Link>
    </div>
  );
}
