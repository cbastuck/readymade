import { s, t } from "../../../styles";

import Runtime from "./Runtime";
import Dots from "./Dots";
import { border, caption, text } from "./common";

export default function Board() {
  return (
    <div style={s(border, t.m(10), t.p(10), { overflowX: "auto" })}>
      <div style={s(t.tc)}>
        <div style={s(t.tl, { marginLeft: 35 })}>
          <div style={caption}>Board</div>
          <div style={text}>Name: Example</div>
          <div style={text}>Topology: Chain</div>
        </div>
      </div>
      <div style={{ margin: "5px 0px" }}>
        <Runtime numServices={3} />
        <Dots />
        <Runtime numServices={2} />
      </div>
    </div>
  );
}
