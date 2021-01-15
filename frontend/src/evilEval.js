/*
export default function evilEval(f, params) {
  if (f && params) {
    const scopedFunction = (term, params) => {
      try {
        return eval(term);
      }
      catch(e) {
        console.error(`Error evaluating ${term} with ${JSON.stringify(params)}`);
        throw e;
      }
    };
    return scopedFunction.call(null, f, params);
  }
}
*/