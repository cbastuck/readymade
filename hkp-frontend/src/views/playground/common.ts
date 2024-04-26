import UAParser from "ua-parser-js";
import { PeerJsHostDescriptor, RuntimeClass, SavedBoard } from "../../types";

export function getActivationId(runtimeId: string) {
  return `peer-${runtimeId}-active`;
}

export const localStoragePrefix = "hkp-playground-";

export const defaultName = "Playground";

const browser = new UAParser().getBrowser();
export const availableRuntimes: Array<RuntimeClass> = [
  { name: `${browser.name}` || "browser", type: "browser" },
];

export function getLocalBoard(
  selectedBoard: string,
  prefix: string = localStoragePrefix
) {
  return localStorage.getItem(`${prefix}${selectedBoard}`);
}

export function getLocalBoards(
  prefix: string = localStoragePrefix
): Array<SavedBoard> {
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

export function restoreBoardFromLocalStorage(name: string) {
  const storageName = name ? `${localStoragePrefix}${name}` : "hkp-playground";
  const data = localStorage.getItem(storageName);
  if (data) {
    const board = JSON.parse(data);
    if (board && board.runtimes) {
      return board;
    }
  }
}

export function storeBoardToLocalStorage(board: string, src: string) {
  localStorage.setItem(`${localStoragePrefix}${board}`, src);
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
