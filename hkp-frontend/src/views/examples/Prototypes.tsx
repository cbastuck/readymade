import { Link } from "react-router-dom";
import WipTag from "../../components/WipTag";

import Headline from "./Headline";

export default function Prototypes() {
  return (
    <div
      style={{
        margin: "50px 0px",
        width: "100%",
        height: "100%",
        fontSize: 16,
        letterSpacing: 1,
        marginLeft: 10,
        lineHeight: 2,
      }}
    >
      <Headline>My Prototypes</Headline>
      <div
        className="hkp-fnt-color"
        style={{
          letterSpacing: 2,
          lineHeight: 1.4,
          display: "flex",
        }}
      >
        The following private prototypes showcase creative ways to connect
        services and address personal needs using Hookup.
        <WipTag />
      </div>

      <div style={{ margin: "10px 10px" }}>
        <div>
          <a
            href={`${window.location.protocol}//bridge.${window.location.host}`}
          >
            Bridge Pitch
          </a>
        </div>
        <div>
          <Link to="/docs/proto/Spotty">Spotty</Link>
        </div>
        <div>
          <Link to="/docs/proto/Multiplication">Multiplication rows</Link>
        </div>
      </div>

      <div style={{ lineHeight: 1.4, fontSize: 14 }}>
        Kindly note that these private prototypes reflect a more personalized
        approach, tailored to my preferences, and may not suit every use case or
        preference.
      </div>
    </div>
  );
}
