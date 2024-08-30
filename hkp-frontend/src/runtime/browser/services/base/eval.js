import { parse, eval as expEval } from "expression-eval";
import moment from "moment";

function reformatDate(date, inputFormat, outputFormat) {
  return moment(date, inputFormat).format(outputFormat);
}

export function parseExpression(f) {
  try {
    return parse(f);
  } catch (err) {
    return "syntax-error";
  }
}

const globalScope = {
  print: console.log,
  log: console.log,
  round: Math.round,
  sin: Math.sin,
  min: Math.min,
  max: Math.max,
  rand: Math.random,
  number: (x) => Number(x),
  string: (x) => `${x}`,
  stringify: JSON.stringify,
  parse: (x) => (x !== undefined ? JSON.parse(x) : "<parse undefined>"),
  concat: (x, y) => `${x}${y}`,
  reformatDate,
  encodeURI,
  blobToUint8Array: async (x) => new Uint8Array(await x.arrayBuffer()),
  slice: (arr, offset, step, end) =>
    arr.slice(offset, end).filter((x, i) => i % step === 0),
  sum: (x) => (x && x.reduce ? x.reduce((acc, v) => acc + v, 0) : x),
  avg: (x) => (x && x.reduce ? x.reduce((acc, v) => acc + v, 0) / x.length : x),
  arrayToAudioBuffer: (arr) => {
    const audioCtx = new AudioContext();
    const buffer = audioCtx.createBuffer(1, arr.length, audioCtx.sampleRate);
    const channel = buffer.getChannelData(0);
    arr.forEach((x, i) => (channel[i] = x));
    return buffer;
  },
  fromQueryParam: (name) => {
    const qp = new URLSearchParams(window.location.search);
    return qp.get(name);
  },
  fromStorage: (name) => localStorage.getItem(name),
};

export async function parseAndEvalExpression(exp, params, app) {
  return evalExpression(parseExpression(exp), params, app);
}

export async function evalExpression(ast, params, app) {
  if (ast === "syntax-error") {
    return "syntax-error";
  }

  const processRuntime =
    app !== undefined
      ? (name, params) => app.processRuntimeByName(name, params)
      : () => console.warn("processRuntime is not supported in this scope");

  const getServiceConfig = (rtId, svcId, prop) =>
    window.hkp.getServiceConfig(rtId, svcId).then((x) => x[prop]);

  return expEval(ast, {
    ...params,
    ...globalScope,
    getServiceConfig,
    processRuntime,
  });
}

export function evilEval(buffer, params) {
  const script = `
    async function hkp(){
      const { params, ...globals } = this;
      ${buffer}
    }
    return hkp.bind({ ...this })();
  `;
  const f = Function(script);
  return f.bind({ ...params, ...globalScope, params })(params);
}
