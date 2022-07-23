import { useParams } from "react-router-dom";

export default function Prototypes() {
  const params = useParams();
  const { name } = params;
  try {
    const { default: Proto } = require(`./${name}`);
    return <Proto />;
  } catch (err) {
    return <div style={{ margin: 10 }}>Invalid prototype: {name} </div>;
  }
}
