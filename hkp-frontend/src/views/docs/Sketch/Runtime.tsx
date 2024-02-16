import Arrow from "./Arrow";

import { s, t } from "../../../styles";
import { flexRow, runtimeDim, caption } from "./common";
import Service from "./Service";

type Props = {
  numServices: number;
};

export default function Runtime({ numServices }: Props) {
  return (
    <div style={flexRow}>
      <Arrow yOffset={75} />
      <div className="hkp-card-border" style={s(runtimeDim, t.mb10, t.p5)}>
        <div
          style={s(caption, t.tc, {
            marginLeft: 10,
            marginBottom: 5,
            marginTop: 5,
          })}
        >
          Runtime
        </div>
        <div style={s(flexRow, t.mb10, { overflowX: "auto" })}>
          <Service />
          <Arrow yOffset={50} />
          <Service />
          {numServices > 2 && <Arrow yOffset={50} />}
          {numServices > 2 && <Service />}
        </div>
      </div>
      <Arrow yOffset={75} />
    </div>
  );
}
