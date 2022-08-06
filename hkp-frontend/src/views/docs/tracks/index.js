import { useParams } from "react-router-dom";

export default function Tracks() {
  const params = useParams();
  const { track } = params;
  try {
    const { default: Track } = require(`./${track}/index`);
    return <Track />;
  } catch (err) {
    return <div style={{ margin: 10 }}>Invalid track: {track} </div>;
  }
}
