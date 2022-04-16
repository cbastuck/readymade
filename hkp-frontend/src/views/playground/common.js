export function getActivationId(runtimeId) {
  return `peer-${runtimeId}-active`;
}

export const localStoragePrefix = "hkp-playground-";

export const defaultBundles = [
  "hookup.to/registry/browser/Audio",
  "hookup.to/registry/browser/Graphic",
  "hookup.to/registry/browser/FileStorage",
];

export const allowedServices = [
  "hookup.to/service/timer",
  "hookup.to/service/monitor",
  "hookup.to/service/canvas",
  "hookup.to/service/map",
  "hookup.to/service/filter",
  "hookup.to/service/camera",
  "hookup.to/service/injector",
  "hookup.to/service/trigger-pad",
  "hookup.to/service/sound",
  "hookup.to/service/audio-output",
  "hookup.to/service/audio-input",
  "hookup.to/service/gif-encoder",
  "hookup.to/service/input",
  "hookup.to/service/output",
  "hookup.to/service/thrower",
  "hookup.to/service/receiver",
  "hookup.to/service/downloader",
  "hookup.to/service/mp3encoder",
  "hookup.to/service/reduce",
  "hookup.to/service/chart",
  "hookup.to/service/spotify",
  "hookup.to/service/github-source",
  "hookup.to/service/github-sink",
  "hookup.to/service/cache",
  "hookup.to/service/key-handler",
  "hookup.to/service/reactor",
  "hookup.to/service/xy-pad",
];

export const defaultName = "Playground";

export const availableRuntimes = [
  { name: "browser", type: "browser" },
  // { name: "hookup", type: "node" },
];
