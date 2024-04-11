import { Link } from "react-router-dom";

import Usecases from "../../components/BoardCollection/Usecases";

export default function Showcases() {
  return (
    <div style={{ margin: "50px 0px", width: "100%", height: "100%" }}>
      <h2>Showcases</h2>
      <div
        className="font-serif-wet tracking-widest"
        style={{
          marginBottom: 20,
          margin: "30px 20px",
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
