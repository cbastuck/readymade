import { Link } from "react-router-dom";

import Headline from "./Headline";
import Usecases from "../playground/Usecases";

export default function Showcases() {
  return (
    <div style={{ marginTop: "30px", width: "100%", height: "100%" }}>
      <Headline>Showcases</Headline>
      <div
        style={{
          fontFamily: "Roboto",
          fontSize: 16,
          color: "rgb(85, 85, 85)",
          lineHeight: 1.5,
          letterSpacing: 1,
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
