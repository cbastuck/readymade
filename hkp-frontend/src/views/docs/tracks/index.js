import { useParams } from "react-router-dom";

import Brand from "./Brand";
import Remotes from "./Remotes";

export default function Tracks() {
  const params = useParams();
  const { track } = params;
  switch (track) {
    case "brand":
      return <Brand />;
    case "remotes":
      return <Remotes />;
    default:
      return <div>Unknown track: {track}</div>;
  }
}
