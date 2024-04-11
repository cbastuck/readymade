import { Link } from "react-router-dom";
import WipTag from "../../components/WipTag";

export default function Prototypes() {
  return (
    <div
      style={{
        margin: "50px 0px",
        width: "100%",
        height: "100%",
        marginLeft: 10,
      }}
    >
      <h2>My Prototypes</h2>
      <div
        className="font-serif-wet tracking-widest"
        style={{ margin: "30px 20px" }}
      >
        <div className="flex">
          The following private prototypes showcase creative ways to connect
          services and address personal needs using Hookup.
          <WipTag />
        </div>
        <div
          style={{
            width: "95%",
          }}
        >
          Kindly note that these private prototypes reflect a more personalized
          approach, tailored to my preferences, and may not suit every use case
          or preference.
        </div>
        <div className="m-[10px] flex gap-[15px]">
          <div className="flex hkp-card-border font-sans align-middle">
            <Link
              className="p-5"
              to={`${window.location.protocol}//bridge.${window.location.host}`}
            >
              Bridge Pitch
            </Link>
          </div>
          <div className="flex hkp-card-border font-sans align-middle">
            <Link className="p-5" to="/docs/proto/spotty">
              Spotty
            </Link>
          </div>
          <div className="flex hkp-card-border font-sans align-middle">
            <Link className="p-5" to="/docs/proto/multiplication">
              Multiplication rows
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
