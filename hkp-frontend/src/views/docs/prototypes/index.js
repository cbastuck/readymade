import { useParams } from "react-router-dom";

import Spotty from "./Spotty";

export default function Prototypes() {
  const params = useParams();
  const { name } = params;
  switch (name) {
    case "spotty":
      return <Spotty />;

    default:
      return <div>Unknown prototype: {name}</div>;
  }
}
