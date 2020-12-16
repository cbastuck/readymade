export function s() {
  return Array.from(arguments).reduce((a, c) => ({ ...a, ...c }), {});
}

export const t = {
  uc: { textTransform: 'uppercase' },
  ul: { textDecoration: 'underline' },
  ls1: { letterSpacing: 1 },
  lh1_5: { lineHeight: 1.5 },
  lh1_6: { lineHeight: 1.6 },
  lh1_7: { lineHeight: 1.7 },
  lh1_8: { lineHeight: 1.8 },
  lh2: { lineHeight: 2 },
  lh3: { lineHeight: 3 },

  fs: function(s) { return { fontSize: s}; },
  fs14: { fontSize: 14 },
  fs13: { fontSize: 13 },
  fs12: { fontSize: 12 },
  fs11: { fontSize: 11 },
  fs10: { fontSize: 10 },

  m: function(x, y){ return y === undefined ? { margin: x } : { margin: `${y}px ${x}px` }; },
  m2: { margin: 2 },
  m3: { margin: 3 },
  m5: { margin: 5 },
  m10: { margin: 10 },
  mt: function(x){ return { marginTop: x }; },
  mt2: { marginTop: 2 },
  mt3: { marginTop: 3 },
  mt5: { marginTop: 5 },
  mt10: { marginTop: 10 }, 
  mb: function(x){ return { marginBottom: x }; },
  mb2: { marginBottom: 2 },
  mb3: { marginBottom: 3 },
  mb5: { marginBottom: 5 },
  mb10: { marginBottom: 10 },
  mv: function(x){ return { marginTop: x, marginBottom: x }},
  mh: function(x){ return { marginLeft: x, marginRight: x }},

  p: function(x, y){ return y === undefined ? { padding: x } : { padding: `${y}px ${x}px` }; },
  p2: { padding: 2 },
  p3: { padding: 3 },
  p5: { padding: 5 },
  p10: { padding: 10 },

  w100: { width: '100%' },
  h100: { height: '100%' },
  fill: {
    width: '100%', 
    height: '100%',
  },

  tl: { textAlign: 'left' },
  tc: { textAlign: 'center' },
  tr: { textAlign: 'right' },
  right: { width: '100%', textAlign: 'right' },
  
  bc: function (col) { return { backgroundColor: col }; },
  borderCol: function(col) { return { border: `solid 1px ${col}`}; },
  border: { border: 'solid 1px gray' },
  br2: { borderRadius: 2 },
  br3: { borderRadius: 3 },
  br5: { borderRadius: 5 },
  br10: { borderRadius: 10 },

  unselectable: {
    WebkitTouchCallout: 'none',
    WebkitUserSelect: 'none',
    KhtmlUserSelect: 'none',
    MozUserSelect: 'none',
    MsUserSelect: 'none',
    UserSelect: 'none',
    WebkitTapHighlightColor: 'rgba(0,0,0,0)'
  },

}