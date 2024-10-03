import { s, t } from "../../../styles";

import Runtime from "./Runtime";
import Dots from "./Dots";

export default function Sketch() {
  return (
    <div
      className="leading-5"
      style={{
        width: "95%",
        margin: "auto",
        marginTop: 20,
      }}
    >
      <div
        className="border font-sans"
        style={s(t.m(10), t.p(10), { overflowX: "auto" })}
      >
        <div style={s(t.tc)}>
          <div style={s(t.tl, { marginLeft: 35 })}>
            <div>Boardname: Example</div>
            <div>Topology: Chain</div>
          </div>
        </div>
        <div style={{ margin: "5px 0px" }}>
          <Runtime numServices={3} />
          <Dots />
          <Runtime numServices={2} />
        </div>
      </div>
    </div>
  );
}
