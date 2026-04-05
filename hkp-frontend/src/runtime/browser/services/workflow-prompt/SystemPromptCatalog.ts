import { AppInstance } from "hkp-frontend/src/types";

type ServicePromptSpec = {
  modes?: string;
  config?: string;
  input?: string;
  output?: string;
  arrays?: string;
  binary?: string;
  mixedData?: string;
};

const DEFAULT_SPEC: Required<ServicePromptSpec> = {
  modes: "unspecified",
  config: "unspecified",
  input: "any/unknown",
  output: "unknown",
  arrays: "unknown",
  binary: "unknown",
  mixedData:
    "not native (assume false unless runtime-specific note says otherwise)",
};

const HKP_PYTHON_SERVICES = [
  "monitor",
  "map",
  "sub-service",
  "http-server-subservices",
  "timer",
];

const HKP_NODE_SERVICES = ["hookup.to/service/monitor"];

const HKP_RT_SERVICES = [
  "buffer",
  "cache",
  "cache-subservices",
  "core-input",
  "core-output",
  "fft",
  "filesystem",
  "ffmpeg",
  "filter",
  "http-client",
  "http-server",
  "http-server-subservices",
  "ifft",
  "map",
  "monitor",
  "mp4-to-wav",
  "static",
  "sub-service",
  "timer",
  "transients",
  "wav-reader",
  "websocket-client",
  "websocket-reader",
  "websocket-socket",
  "websocket-writer",
];

const BROWSER_SERVICE_SPECS: Record<string, ServicePromptSpec> = {
  "hookup.to/service/timer": {
    modes: "periodic|oneShot",
    config:
      "periodic,periodicValue,periodicUnit,oneShotDelay,oneShotDelayUnit,running,start,stop,restart,immediate,until.triggerCount",
    input: "any for oneShot delay path",
    output: "{triggerCount,...input?} on tick or delayed pass-through",
    arrays: "treats array as generic input",
    binary: "pass-through in delayed mode",
    mixedData: "not native",
  },
  "hookup.to/service/map": {
    modes: "replace|add|overwrite plus sensingMode",
    config: "template (keys ending '=' are expressions),mode,sensingMode",
    input: "object|array|scalar",
    output: "mapped object/scalar; null when sensingMode captures template",
    arrays: "maps each element",
    binary: "not intended for raw binary",
    mixedData: "not native",
  },
  "hookup.to/service/filter": {
    modes: "aggregator and|or",
    config: "conditions:string|string[],aggregator",
    input: "object|array",
    output: "input if predicate true; null if false",
    arrays: "filters array entries",
    binary: "not intended",
    mixedData: "not native",
  },
  "hookup.to/service/buffer": {
    modes: "capacity flush and/or interval flush",
    config: "capacity,interval(sec),accumulatedOutput,action=clear",
    input: "any",
    output:
      "slice array on capacity flush; whole buffered array on timer flush; or null",
    arrays: "concats input arrays into buffer",
    binary: "can carry binary as opaque values",
    mixedData: "not native",
  },
  "hookup.to/service/canvas": {
    modes: "render pass-through or capture",
    config: "size,resizable,clearOnRedraw,fullscreen,capture,reportSizeUpdate",
    input: "draw payload object/array",
    output:
      "same payload by default; Blob frame when capture enabled; size updates via next",
    arrays: "passed through",
    binary: "outputs Blob in capture mode",
    mixedData: "not native",
  },
  "hookup.to/service/monitor": {
    modes: "observe",
    config: "logToConsole",
    input: "any",
    output: "identity pass-through",
    arrays: "pass-through",
    binary: "UI can inspect Blob/ArrayBuffer/Uint8Array",
    mixedData: "not native",
  },
  "hookup.to/service/select": {
    modes: "index select",
    config: "arrayIndex",
    input: "array preferred",
    output: "array[arrayIndex] or identity fallback",
    arrays: "primary behavior",
    binary: "not intended",
    mixedData: "not native",
  },
  "hookup.to/service/switch": {
    modes: "identity",
    config: "none",
    input: "any",
    output: "identity pass-through",
    arrays: "pass-through",
    binary: "pass-through",
    mixedData: "not native",
  },
  "hookup.to/service/stats": {
    modes: "feature extraction",
    config: "property,features.{mean,std,max},copyProps",
    input: "array of objects (or single object normalized to array)",
    output: "[metaStats,...originalItems]",
    arrays: "native",
    binary: "not intended",
    mixedData: "not native",
  },
  "hookup.to/service/board-service": {
    modes: "saved-board runner or incoming-board preview",
    config: "selectedBoard",
    input: "board descriptor to preview OR runtime params to process",
    output: "play result or preview acknowledgement",
    arrays: "can process arrays item-by-item",
    binary: "depends on target board services",
    mixedData: "not native",
  },
};

function normalizeSpec(spec?: ServicePromptSpec): Required<ServicePromptSpec> {
  return {
    modes: spec?.modes || DEFAULT_SPEC.modes,
    config: spec?.config || DEFAULT_SPEC.config,
    input: spec?.input || DEFAULT_SPEC.input,
    output: spec?.output || DEFAULT_SPEC.output,
    arrays: spec?.arrays || DEFAULT_SPEC.arrays,
    binary: spec?.binary || DEFAULT_SPEC.binary,
    mixedData: spec?.mixedData || DEFAULT_SPEC.mixedData,
  };
}

function toServiceDocHeader(
  serviceId: string,
  serviceName: string,
  spec?: ServicePromptSpec,
) {
  const normalized = normalizeSpec(spec);
  return [
    `[Service] ${serviceId}`,
    `Name: ${serviceName}`,
    `Modes: ${normalized.modes}`,
    `Config: ${normalized.config}`,
    `IO: in=${normalized.input} -> out=${normalized.output}`,
    `Types: arrays=${normalized.arrays}; binary=${normalized.binary}; mixedData=${normalized.mixedData}`,
  ];
}

function buildBrowserServiceHeaders(app: AppInstance): string[] {
  const services = app
    .listAvailableServices()
    .map((svc) => ({
      serviceId: svc.serviceId,
      serviceName: svc.serviceName,
    }))
    .sort((a, b) => a.serviceId.localeCompare(b.serviceId));

  return services.flatMap((svc, idx) => {
    const header = toServiceDocHeader(
      svc.serviceId,
      svc.serviceName,
      BROWSER_SERVICE_SPECS[svc.serviceId],
    );
    const separator = idx + 1 < services.length ? ["---"] : [];
    return [...header, ...separator];
  });
}

export function buildWorkflowSystemPrompt(app: AppInstance) {
  const browserServiceHeaders = buildBrowserServiceHeaders(app);

  return [
    "You convert natural-language workflows into HKP board JSON.",
    "Return ONLY valid JSON (no markdown, no prose).",
    "",
    "Schema:",
    '{"boardName":string,"runtimes":[{"id":string,"name":string,"type":"browser"|"rest"|"graphql","state"?:object,"url"?:string}],"services":{"<runtimeId>":[{"uuid":string,"serviceId":string,"serviceName":string,"state":object}]},"inputRouting"?:object,"outputRouting"?:object,"sidechainRouting"?:object}',
    "",
    "Planning rules:",
    "- Use one or more runtimes when useful; do not force single-runtime boards.",
    "- Runtime/service IDs must be unique where required.",
    "- Service state must be practical and immediately runnable.",
    "- Prefer explicit defaults over omitted critical fields.",
    "",
    "Data model rules:",
    "- Browser services are generally JSON-first; some services accept/pass binary as opaque payloads.",
    "- Array handling is service-specific; obey service notes below.",
    "- MixedData is currently an hkp-rt concept (meta JSON + binary bytes).",
    "",
    "Browser service documentation headers:",
    ...browserServiceHeaders,
    "",
    "hkp-rt service IDs:",
    `- ${HKP_RT_SERVICES.join(",")}`,
    "hkp-rt data types (high-level):",
    "- json, string, binary, ringbuffer, MixedData(meta+binary), control-flow/custom wrappers",
    "",
    "hkp-node service IDs:",
    `- ${HKP_NODE_SERVICES.join(",")}`,
    "hkp-python service IDs:",
    `- ${HKP_PYTHON_SERVICES.join(",")}`,
  ].join("\n");
}
