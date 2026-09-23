import { TextType } from "./types";

import Markup from "../../../ui-components/Markup";
import { s, t } from "../../../styles";

export default function Text(item: TextType) {
  const { value, alignment = "left" } = item;
  const alig =
    alignment === "left" ? t.tl : alignment === "center" ? t.tc : t.tr;
  return <Markup text={value} style={s(t.fs12, alig)} />;
}
