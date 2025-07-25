import Text from "hkp-frontend/src/ui-components/Text";
import { Link } from "react-router-dom";

export default function Intro() {
  return (
    <>
      <h2 className="text-left">Basic</h2>
      <Text>
        The basic examples show a limited set of possibilities. They run in a
        Sandbox, designed for constructing flows that primarily operate locally
        without the need for a login or additional external resources.
      </Text>
      <Text>
        More is possible when combining remote and local runtimes on one board.
        For a deeper exploration of advanced features, visit
        <Link to="/playground"> Playground</Link>.
      </Text>
    </>
  );
}
