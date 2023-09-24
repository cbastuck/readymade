import { Link } from "react-router-dom";

import { ReactComponent as IconH } from "./assets/hkp-single-dot-h.svg";
import Icon from "./assets/hkp-single-dot-second-trial-edgy.png";

export default function HomeIcon() {
  const IconSvg = IconH;
  return (
    <div
      style={{
        paddingTop: 7,
        paddingLeft: 1,
        paddingRight: 1,
        marginLeft: 4,
        marginRight: 1,
      }}
    >
      <Link to="/">
        {false ? (
          <img style={{ margin: "2px" }} height={22} src={Icon} alt="Hookup" />
        ) : (
          <div style={{ padding: "2px" }}>
            <IconSvg width={22} />
          </div>
        )}
      </Link>
    </div>
  );
}
