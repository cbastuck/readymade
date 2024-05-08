import { Link } from "react-router-dom";

import Text from "@/ui-components/Text";
import Usecases from "../../components/BoardCollection/Usecases";

export default function Showcases() {
  return (
    <div style={{ margin: "50px 0px", width: "100%", height: "100%" }}>
      <h2>Showcases</h2>
      <Text>
        The following showcases operate in the{" "}
        <Link to="/playground">Playground</Link>, featuring multiple local
        runtimes interconnected. This configuration enables more intricate
        possibilities compared to the sandbox environment. However, the true
        potential unfolds when incorporating remote runtimes into a single
        board.
      </Text>

      <Usecases headline="" renderSearch={false} />
    </div>
  );
}
