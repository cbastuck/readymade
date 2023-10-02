import { PeerJsHostDescriptor, RuntimeClass, SavedBoard } from "../../types";

export function getActivationId(runtimeId: string) {
  return `peer-${runtimeId}-active`;
}

export const localStoragePrefix = "hkp-playground-";

export const defaultBundles = [
  "hookup.to/registry/browser/Audio",
  "hookup.to/registry/browser/Graphic",
  "hookup.to/registry/browser/FileStorage",
  "hookup.to/registry/browser/Crypto",
  "hookup.to/registry/browser/TensorFlow",
  "hookup.to/registry/browser/Fileformat",
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
  "hookup.to/service/audio-recorder",
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
  "hookup.to/service/encrypt",
  "hookup.to/service/decrypt",
  "hookup.to/service/hash",
  "hookup.to/service/sign",
  "hookup.to/service/linear-regression",
  "hookup.to/service/xlsl",
  "hookup.to/service/select",
  "hookup.to/service/hacker/considered",
  "hookup.to/service/hacker/dangerous",
];

export const defaultName = "Playground";

export const availableRuntimes: Array<RuntimeClass> = [
  { name: "browser", type: "browser" },
  // { name: "hookup", type: "node" },
];

export function getLocalBoards(prefix: string): Array<SavedBoard> {
  const savedBoards = [];
  for (const key in localStorage) {
    if (key.startsWith(prefix)) {
      const data = localStorage.getItem(key);
      if (!data) {
        console.warn(`Got empty local board: ${key}`);
      } else {
        try {
          const value = JSON.parse(data);
          savedBoards.push({
            name: key.substr(prefix.length),
            value,
          });
        } catch (err) {
          console.warn("Could not restore local board", key, err);
        }
      }
    }
  }

  return savedBoards.map((item) => ({
    ...item,
    url: `/playground/${item.name}`,
    description: item.value && item.value.description,
  }));
}

const isSecureConnection = window.location.protocol === "https:";

export const availableDiscoveryPeerHosts: Array<PeerJsHostDescriptor> = [
  {
    host: "peers.hookup.to",
    port: 443,
    path: "/",
    secure: true,
  },
  {
    host: `peers.${window.location.hostname}`,
    port: isSecureConnection ? 443 : 80,
    path: "/",
    secure: isSecureConnection,
  },
];
