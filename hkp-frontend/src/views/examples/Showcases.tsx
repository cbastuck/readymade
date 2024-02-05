import { Link } from "react-router-dom";

import Headline from "./Headline";
import Usecases from "../../components/BoardCollection/Usecases";

export default function Showcases() {
  return (
    <div style={{ margin: "50px 0px", width: "100%", height: "100%" }}>
      <Headline>Showcases</Headline>
      <div
        className="hkp-fnt-color"
        style={{
          letterSpacing: 2,
          lineHeight: 1.4,
          marginBottom: 20,
        }}
      >
        Following show-cases run on <Link to="/playground">Playground</Link>.
        They consist of multiple runtimes connected to another. With this setup
        you can do much more than with a sandbox. Still the real potential comes
        with adding remote runtimes to the board.
      </div>

      <Usecases headline="" renderSearch={false} />
    </div>
  );
}
