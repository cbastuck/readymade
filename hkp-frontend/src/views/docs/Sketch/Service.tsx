import { s, t } from "../../../styles";
import Configuration from "./Configuration";
import { caption, serviceDim } from "./common";

export default function Service() {
  return (
    <div className="border" style={s(serviceDim, t.m(10, 5), t.p(10))}>
      <div style={s(caption, t.tc)}>Service</div>
      <Configuration />
    </div>
  );
}
