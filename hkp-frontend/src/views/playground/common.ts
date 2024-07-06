import { DragEvent } from "react";
import UAParser from "ua-parser-js";
import { PeerJsHostDescriptor, RuntimeClass, SavedBoard } from "../../types";

export function getActivationId(runtimeId: string) {
  return `peer-${runtimeId}-active`;
}

export const localStoragePrefix = "hkp-playground-";

export const defaultName = "Playground";

const browser = new UAParser().getBrowser();
export const availableRuntimeEngines: Array<RuntimeClass> = [
  { name: `${browser.name}` || "browser", type: "browser" },
];

export function getLocalBoard(
  selectedBoard: string,
  prefix: string = localStoragePrefix
) {
  const item = localStorage.getItem(`${prefix}${selectedBoard}`);
  if (!item) {
    return;
  }
  const data = JSON.parse(item);
  if (data.source) {
    return JSON.parse(data.source);
  }
  return data;
}

export function removeLocalBoard(board: SavedBoard) {
  localStorage.removeItem(board.id);
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
            name: key.substring(prefix.length),
            value: value.source ? value.source : value,
            id: key,
            createdAt: value.createdAt,
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

export type LocalBoard = {
  source: string;
  createdAt: string;
};

export function restoreBoardFromLocalStorage(name: string) {
  const storageName = name ? `${localStoragePrefix}${name}` : "hkp-playground";
  const data = localStorage.getItem(storageName);
  if (data) {
    const item = JSON.parse(data);
    if (typeof item.source === "string") {
      return JSON.parse(item.source);
    } else if (item && item.runtimes) {
      return item;
    }
  }
}

export function storeBoardToLocalStorage(boardName: string, source: string) {
  const item: LocalBoard = {
    source,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(
    `${localStoragePrefix}${boardName}`,
    JSON.stringify(item)
  );
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

export const defaultDiscoveryPeer = availableDiscoveryPeerHosts[0];

export function readFile(
  file: File | Blob,
  loadAsText: boolean,
  progressFn?: (p: number) => void
) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("error", (_ev: any) => {
      return reject(reader.error);
    });

    reader.addEventListener("loadend", (_ev: any) => {
      const result = loadAsText
        ? reader.result
        : new Blob([reader.result!], { type: "application/octet-stream" });
      progressFn?.(100);
      return resolve(result);
    });
    reader.addEventListener("progress", (ev) => {
      const fileProgress = Math.round((ev.loaded / ev.total) * 100);
      progressFn?.(fileProgress);
    });

    if (loadAsText) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
    progressFn?.(0);
  });
}

export function getDraggedFiles(ev: DragEvent): Array<File> {
  const files: Array<File> = [];
  if (ev.dataTransfer?.items) {
    [...ev.dataTransfer.items].forEach((item) => {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) {
          files.push(f);
        }
      }
    });
  } else if (ev.dataTransfer?.files) {
    // Use DataTransfer interface to access the file(s)
    [...ev.dataTransfer.files].forEach((file) => {
      files.push(file);
    });
  }
  return files;
}
