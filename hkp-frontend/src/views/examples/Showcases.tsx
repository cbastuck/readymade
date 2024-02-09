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
        The following showcases operate in the{" "}
        <Link to="/playground">Playground</Link>, featuring multiple local
        runtimes interconnected. This configuration enables more intricate
        possibilities compared to the sandbox environment. However, the true
        potential unfolds when incorporating remote runtimes into a single
        board.
      </div>

      <Usecases headline="" renderSearch={false} />
    </div>
  );
}
