import { Link } from "react-router-dom";

import Text from "hkp-frontend/src/ui-components/Text";
import Usecases from "../../components/BoardCollection/Usecases";

export default function Showcases() {
  return (
    <div style={{ margin: "50px 0px", width: "100%", height: "100%" }}>
      <h2 className="text-left">Showcases</h2>
      <Text>
        The following showcases operate in the{" "}
        <Link to="/playground">Playground</Link>, featuring multiple local
        runtimes interconnected. This configuration enables more intricate
        possibilities compared to the sandbox environment. However, even more
        and interesting setups appear when introducing remote runtimes into a
        board mixed with browser runtimes.
      </Text>

      <Usecases renderSearch={false} />
    </div>
  );
}
