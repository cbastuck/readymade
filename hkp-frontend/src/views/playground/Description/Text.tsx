import { TextType } from "./types";

import { s, t } from "../../../styles";

export default function Text(item: TextType) {
  const { value, alignment = "left" } = item;
  const alig =
    alignment === "left" ? t.tl : alignment === "center" ? t.tc : t.tr;
  return <div style={s(t.fs12, alig)}> {value} </div>;
}
