export default function evilEval(f, params) {
  if (f && params) {
    const scopedFunction = (term, params) => {
      return eval(term);
    };
    return scopedFunction.call(null, f, params);
  }
}