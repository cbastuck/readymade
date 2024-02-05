import { s, t } from "../../../styles";

import { HeadlineType } from "./types";

export default function Headline(item: HeadlineType) {
  return (
    <h1 className="hkp-fnt-family" style={s(t.fs14, t.ls2, t.tc)}>
      {item.text}
    </h1>
  );
}
