import { CSSProperties, ReactNode } from "react";

export function s(...args: any[]): CSSProperties {
  return Array.from(args).reduce((a, c) => ({ ...a, ...c }), {});
}

export const zLayers = {
  foreground: 2000003,
};

//type CSSGenerator = { (...a: any[]): CSSProperties };
type StyleType = any; //CSSProperties | CSSGenerator
export const t: { [key: string]: StyleType } = {
  uc: { textTransform: "uppercase" },
  nc: { textTransform: "none" },
  ul: { textDecoration: "underline" },
  ls0: { letterSpacing: 0 },
  ls1: { letterSpacing: 1 },
  ls2: { letterSpacing: 2 },
  ls3: { letterSpacing: 3 },
  ls4: { letterSpacing: 4 },
  fs20: { fontSize: 20 },
  fs19: { fontSize: 19 },
  fs18: { fontSize: 18 },
  fs17: { fontSize: 17 },
  fs16: { fontSize: 16 },
  fs15: { fontSize: 15 },
  fs14: { fontSize: 14 },
  fs13: { fontSize: 13 },
  fs12: { fontSize: 12 },
  fs11: { fontSize: 11 },
  fs10: { fontSize: 10 },
  fs9: { fontSize: 9 },
  fs8: { fontSize: 8 },
  fs6: { fontSize: 6 },
  fs4: { fontSize: 4 },

  it: { fontStyle: "italic" },
  italic: { fontStyle: "italic" },
  bo: { fontWeight: "bold" },
  bold: { fontWeight: "bold" },
  normal: { fontWeight: "normal" },

  nw: { whiteSpace: "nowrap" },
  nowrap: { whiteSpace: "nowrap" },

  resizable: {
    resize: "both",
    //overflow: "auto",
  },

  m0: { margin: 0 },
  m1: { margin: 1 },
  m2: { margin: 2 },
  m3: { margin: 3 },
  m5: { margin: 5 },
  m6: { margin: 6 },
  m7: { margin: 7 },
  m8: { margin: 8 },
  m9: { margin: 9 },
  m10: { margin: 10 },

  mt0: { marginTop: 0 },
  mt1: { marginTop: 1 },
  mt2: { marginTop: 2 },
  mt3: { marginTop: 3 },
  mt5: { marginTop: 5 },
  mt6: { marginTop: 6 },
  mt7: { marginTop: 7 },
  mt8: { marginTop: 8 },
  mt9: { marginTop: 9 },
  mt10: { marginTop: 10 },
  mt15: { marginTop: 15 },
  mt20: { marginTop: 20 },
  mt25: { marginTop: 25 },
  mt30: { marginTop: 30 },
  mt35: { marginTop: 35 },

  mb0: { marginBottom: 0 },
  mb1: { marginBottom: 1 },
  mb2: { marginBottom: 2 },
  mb3: { marginBottom: 3 },
  mb5: { marginBottom: 5 },
  mb6: { marginBottom: 6 },
  mb7: { marginBottom: 7 },
  mb8: { marginBottom: 8 },
  mb9: { marginBottom: 9 },
  mb10: { marginBottom: 10 },
  mb20: { marginBottom: 20 },
  mb30: { marginBottom: 30 },

  p2: { padding: 2 },
  p3: { padding: 3 },
  p5: { padding: 5 },
  p10: { padding: 10 },

  pt0: { paddingTop: 0 },
  pt1: { paddingTop: 1 },
  pt2: { paddingTop: 2 },
  pt3: { paddingTop: 3 },
  pt5: { paddingTop: 5 },
  pt6: { paddingTop: 6 },
  pt7: { paddingTop: 7 },
  pt8: { paddingTop: 8 },
  pt9: { paddingTop: 9 },
  pt10: { paddingTop: 10 },
  pt20: { paddingTop: 20 },
  pt30: { paddingTop: 30 },

  pb2: { paddingBottom: 2 },
  pb3: { paddingBottom: 3 },
  pb5: { paddingBottom: 5 },
  pb6: { paddingBottom: 6 },
  pb7: { paddingBottom: 7 },
  pb8: { paddingBottom: 8 },
  pb9: { paddingBottom: 9 },
  pb10: { paddingBottom: 10 },
  pb20: { paddingBottom: 20 },
  pb30: { paddingBottom: 30 },

  w100: { width: "100%" },
  h100: { height: "100%" },
  fill: {
    width: "100%",
    height: "100%",
  },

  tl: { textAlign: "left" },
  tc: { textAlign: "center" },
  tr: { textAlign: "right" },
  right: { width: "100%", textAlign: "right" },

  border: { border: "solid 1px gray" },
  br2: { borderRadius: 2 },
  br3: { borderRadius: 3 },
  br5: { borderRadius: 5 },
  br10: { borderRadius: 10 },

  unselectable: {
    WebkitTouchCallout: "none",
    WebkitUserSelect: "none",
    KhtmlUserSelect: "none",
    MozUserSelect: "none",
    msUserSelect: "none",
    userSelect: "none",
    WebkitTapHighlightColor: "rgba(0,0,0,0)",
  },

  selectable: {
    WebkitTouchCallout: "initial",
    WebkitUserSelect: "initial",
    KhtmlUserSelect: "initial",
    MozUserSelect: "initial",
    msUserSelect: "initial",
    userSelect: "initial",
    WebkitTapHighlightColor: "initial",
  },
  fs: function (s: number | string) {
    return { fontSize: s };
  },
  m: function (x: number | string, y: number | string | undefined) {
    return y === undefined ? { margin: x } : { margin: `${y}px ${x}px` };
  },
  mt: function (x: number | string) {
    return { marginTop: x };
  },
  ml: function (x: number | string) {
    return { marginLeft: x };
  },
  mr: function (x: number | string) {
    return { marginRight: x };
  },
  mb: function (x: number | string) {
    return { marginBottom: x };
  },
  mv: function (x: number | string) {
    return { marginTop: x, marginBottom: x };
  },
  mh: function (x: number | string) {
    return { marginLeft: x, marginRight: x };
  },
  p: function (x: number | string, y: number | string | undefined) {
    return y === undefined ? { padding: x } : { padding: `${y}px ${x}px` };
  },
  pt: function (x: number | string) {
    return { paddingTop: x };
  },
  pb: function (x: number | string) {
    return { paddingBottom: x };
  },
  bc: function (col: string) {
    return { backgroundColor: col };
  },
  borderCol: function (col: string) {
    return { border: `solid 1px ${col}` };
  },
};

t.text = s(t.uc, t.ls1, t.fs12);

type HStackProps = {
  gap?: number | string;
  style?: CSSProperties;
  children: ReactNode;
};
export function HStack({
  gap = undefined,
  style: _style = {},
  children = null,
}: HStackProps) {
  const style: CSSProperties = {
    display: "flex",
    flexDirection: "row",
    width: "100%",
    ..._style,
  };
  if (gap !== undefined) {
    style.gap = gap;
  }
  return <div style={style}>{children}</div>;
}

export function VStack({
  gap = undefined,
  style: _style = {},
  children = null,
}) {
  const style: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    ..._style,
  };
  if (gap !== undefined) {
    style.gap = gap;
  }
  return <div style={style}>{children}</div>;
}
