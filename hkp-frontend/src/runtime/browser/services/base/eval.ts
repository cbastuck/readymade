import { parse, eval as expEval } from "expression-eval";
import moment from "moment";
import { v4 as uuidv4, v7 as uuidv7 } from "uuid";
import jsep from "jsep";
import { AppImpl, AppInstance } from "@/types";

export type Expression = jsep.Expression;

function reformatDate(date: string, inputFormat: string, outputFormat: string) {
  return moment(date, inputFormat).format(outputFormat);
}

export function parseExpression(f: string): Expression | "syntax-error" {
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
  number: (x: string | number) => Number(x),
  string: (x: number | string) => `${x}`,
  stringify: JSON.stringify,
  parse: (x: string | undefined) =>
    x !== undefined ? JSON.parse(x) : "<parse undefined>",
  concat: (x: string, y: string) => `${x}${y}`,
  reformatDate,
  encodeURI,
  blobToUint8Array: async (x: Blob) => new Uint8Array(await x.arrayBuffer()),
  slice: (arr: Array<any>, offset: number, step: number, end: number) =>
    arr.slice(offset, end).filter((x, i) => i % step === 0),
  sum: (x: Array<number>) =>
    x && x.reduce ? x.reduce((acc, v) => acc + v, 0) : x,
  avg: (x: Array<number>) =>
    x && x.reduce ? x.reduce((acc, v) => acc + v, 0) / x.length : x,
  arrayToAudioBuffer: (arr: Array<number>) => {
    const audioCtx = new AudioContext();
    const buffer = audioCtx.createBuffer(1, arr.length, audioCtx.sampleRate);
    const channel = buffer.getChannelData(0);
    arr.forEach((x, i) => (channel[i] = x));
    return buffer;
  },
  fromQueryParam: (name: string) => {
    const qp = new URLSearchParams(window.location.search);
    return qp.get(name);
  },
  fromStorage: (name: string) => localStorage.getItem(name),
  uuid: {
    v4: uuidv4,
    v7: uuidv7,
  },
};

export async function parseAndEvalExpression(
  exp: string,
  params: any,
  app?: AppInstance
) {
  return evalExpression(parseExpression(exp), params, app);
}

export async function evalExpression(
  ast: Expression | "syntax-error",
  params: any,
  app?: AppImpl
) {
  if (ast === "syntax-error") {
    return "syntax-error";
  }

  const processRuntime =
    app !== undefined
      ? (rtName: string, params: any) =>
          app?.processRuntimeByName?.(rtName, params)
      : () => console.warn("processRuntime is not supported in this scope");

  const getServiceConfig = (rtId: string, svcId: string, prop: string) =>
    (window as any).hkp.getServiceConfig(rtId, svcId).then((x: any) => x[prop]); // window.hkp is untyped

  return expEval(ast, {
    ...params,
    ...globalScope,
    getServiceConfig,
    processRuntime,
  });
}

export function evilEval(buffer: string, params: any) {
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
