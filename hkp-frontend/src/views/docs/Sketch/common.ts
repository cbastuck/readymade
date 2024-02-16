import { CSSProperties } from "react";
import { s, t } from "../../../styles";

export const flexRow: CSSProperties = { display: "flex", flexDirection: "row" };
export const border: CSSProperties = {
  border: "solid 1px #AAA",
  borderRadius: 5,
};
export const serviceDim: CSSProperties = { width: "100%" };
export const runtimeDim: CSSProperties = { width: "100%" };
export const text: CSSProperties = s(t.ls1, t.fs12);
export const caption: CSSProperties = s(
  t.ls1,
  t.fs14,
  { color: "#4183c4" },
  t.mb2
);
