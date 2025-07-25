import { Link } from "react-router-dom";
import WipTag from "../../components/WipTag";

import Text from "hkp-frontend/src/ui-components/Text";

export default function Prototypes() {
  const linkStyle = "p-5 hover:no-underline";
  return (
    <div className="w-full h-full ml-4">
      <div className="flex">
        <h2>Personal Prototypes</h2>
        <WipTag />
      </div>
      <Text>
        The following private prototypes showcase creative ways to connect
        services and address personal needs using Hookup. I added them as a kind
        of teaser for creative ways of hooking up simple building blocks and
        letting them communicate.
      </Text>
      <Text>
        Kindly note that these private prototypes reflect a more personalized
        approach, tailored to my preferences, and may not suit every use case or
        preference.
      </Text>
      <div className="m-[10px] flex gap-[15px]">
        <div className="flex hkp-card-border font-sans align-middle">
          <Link
            className={linkStyle}
            to={`${window.location.protocol}//bridge.${window.location.host}`}
          >
            Bridge Pitch
          </Link>
        </div>
        <div className="flex hkp-card-border font-sans align-middle">
          <Link className={linkStyle} to="/docs/proto/spotty">
            Spotty
          </Link>
        </div>
        <div className="flex hkp-card-border font-sans align-middle">
          <Link className={linkStyle} to="/docs/proto/multiplication">
            Multiplication rows
          </Link>
        </div>
      </div>
    </div>
  );
}
