import Arrow from "./Arrow";

import { s, t } from "../../../styles";
import { runtimeDim, caption } from "./common";
import Service from "./Service";

type Props = {
  numServices: number;
};

export default function Runtime({ numServices }: Props) {
  return (
    <div className="flex items-center">
      <Arrow />
      <div className="border" style={s(runtimeDim, t.mb10, t.p5)}>
        <div
          style={s(caption, t.tc, {
            marginLeft: 10,
            marginBottom: 5,
            marginTop: 5,
          })}
        >
          Runtime
        </div>
        <div
          className="flex items-center"
          style={s(t.mb10, { overflowX: "auto" })}
        >
          <Service />
          <Arrow />
          <Service />
          {numServices > 2 && <Arrow />}
          {numServices > 2 && <Service />}
        </div>
      </div>
      <Arrow />
    </div>
  );
}
