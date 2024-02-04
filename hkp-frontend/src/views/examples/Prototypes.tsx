import { Link } from "react-router-dom";
import WipTag from "../../components/WipTag";

import Headline from "./Headline";

export default function Prototypes() {
  return (
    <div style={{ margin: "50px 0px", width: "100%", height: "100%" }}>
      <Headline>My Prototypes</Headline>
      <div
        className="hkp-fn-p"
        style={{
          letterSpacing: 2,
          lineHeight: 1.8,
          color: "rgb(85, 85, 85)",
          display: "flex",
        }}
      >
        Following private prototypes show creative ways to connect services and
        make things with Hookup that became relevant on a personal level
        <WipTag />
      </div>
      <div
        style={{
          margin: "10px 10px",
        }}
      >
        <div
          style={{
            fontSize: 16,
            letterSpacing: 1,
            marginLeft: 10,
            lineHeight: 2,
          }}
        >
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
      </div>
    </div>
  );
}
