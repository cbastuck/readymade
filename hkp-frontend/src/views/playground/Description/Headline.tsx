import { s, t } from "../../../styles";

import { HeadlineType } from "./types";

export default function Headline(item: HeadlineType) {
  return <h1 style={s(t.fs14, t.uc, t.ls1, t.tc)}>{item.text}</h1>;
}
