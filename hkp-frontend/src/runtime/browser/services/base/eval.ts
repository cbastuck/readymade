import { parse, eval as expEval } from "expression-eval";
import moment from "moment";
import { v4 as uuidv4, v7 as uuidv7 } from "uuid";
import jsep from "jsep";
import { AppImpl, AppInstance } from "hkp-frontend/src/types";
import { vaultGet, vaultSet } from "hkp-frontend/src/vault";

export type Expression = jsep.Expression;

function reformatDate(date: string, inputFormat: string, outputFormat: string) {
  return moment(date, inputFormat).format(outputFormat);
}

export type SyntaxError = "syntax-error";

export function parseExpression(f: string): Expression | SyntaxError {
  try {
    return parse(f);
  } catch (err) {
    console.error("parseExpression", err);
    return "syntax-error";
  }
}

export function fromVault(globalId: string) {
  return vaultGet(globalId);
}

export function toVault(globalId: string, value: string) {
  vaultSet(globalId, value);
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
  concat: (...args: string[]) => args.join(""),
  reformatDate,
  // Current date/time as a formatted string (moment format tokens), e.g.
  // formatNow('dddd, MMMM, D. YYYY HH:mm') -> "Friday, July, 17. 2026 21:13"
  formatNow: (format: string) => moment().format(format),
  // Array search with an expression-string predicate — jsep has no lambdas,
  // so the element is bound as `item` (and its position as `index`) inside
  // the predicate, e.g. find(params.departures, 'isFuture(item.when)').
  find: (arr: Array<any>, predicate: string) =>
    Array.isArray(arr) ? arr.find(itemPredicate(predicate)) : undefined,
  filter: (arr: Array<any>, predicate: string) =>
    Array.isArray(arr) ? arr.filter(itemPredicate(predicate)) : [],
  // Timestamp checks for anything Date can parse (ISO strings, epoch ms).
  isFuture: (ts: string | number | null | undefined) =>
    ts != null && new Date(ts).getTime() >= Date.now(),
  isPast: (ts: string | number | null | undefined) =>
    ts != null && new Date(ts).getTime() < Date.now(),
  encodeURI,
  blobToUint8Array: async (x: Blob) => new Uint8Array(await x.arrayBuffer()),
  slice: (arr: Array<any>, offset: number, step: number, end: number) =>
    arr.slice(offset, end).filter((_, i) => i % step === 0),
  sum: (x: Array<number>) =>
    x && x.reduce ? x.reduce((acc, v) => acc + v, 0) : x,
  flatSum: (x: Array<any>) =>
    x && x.flat ? x.flat().reduce((acc: number, v: number) => acc + v, 0) : 0,
  at: (arr: Array<any>, i: number) =>
    arr[Math.abs(Math.round(i)) % arr.length],
  now: () => Date.now(),
  range: (n: number) => Array.from({ length: Math.max(0, Math.round(n)) }, (_, i) => i),
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
  // Lowercases and strips everything outside [a-z0-9_-], turning free-form
  // text into a canonical identifier — e.g. building a topic for a
  // case-sensitive ntfy fetch URL.
  slug: (x: string | number) => String(x).toLowerCase().replace(/[^a-z0-9_-]/g, ""),
  uuid: {
    v4: uuidv4,
    v7: uuidv7,
  },
  fromVault,
  toVault,
  moment,
};

// Compiles an expression-string predicate for find/filter. The predicate is
// parsed once per call site and evaluated synchronously per element with
// `item`/`index` in scope alongside the global helpers.
function itemPredicate(predicate: string) {
  const ast = parse(predicate);
  return (item: any, index: number) =>
    !!expEval(ast as any, { item, index, ...globalScope });
}

export const globalScopeFunctions = Object.keys({
  ...globalScope,
  ...{
    getServiceConfig: "", // TODO: this will be added when running with an app
    processRuntime: "",
  },
})
  .sort()
  .reduce((acc, key) => {
    const value = ""; // TODO: document arguments
    return { ...acc, [key]: value };
  }, {});

export async function parseAndEvalExpression(
  exp: string,
  params: any,
  app?: AppInstance
) {
  return evalExpression(parseExpression(exp), params, app);
}

export function checkSyntax(statement: string | SyntaxError): true | string {
  if (statement === "syntax-error") {
    return statement;
  }
  try {
    parse(statement);
    return true;
  } catch (err: any) {
    console.error("isSyntacticallyValid", err.message);
    return err.message;
  }
}

export async function evalExpression(
  ast: Expression | SyntaxError,
  params: any,
  app?: AppImpl
) {
  if (ast === "syntax-error") {
    throw new Error("evalExpression with syntax error");
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
    variables: app?.getRuntimeVariable() ?? {},
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
