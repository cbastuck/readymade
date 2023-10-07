// import { compressSync, decompressSync, strToU8, strFromU8 } from "fflate";

import { generateRandomName } from "../../core/board";

export function encodeBoardState(src: string) {
  /*const compressed = compressSync(strToU8(src));
  const compressedB64Encoded = btoa(
    String.fromCharCode.apply(null, compressed as any)
  );*/
  return btoa(src);
}

export function createBoardLink(src: string) {
  const encoded = encodeBoardState(src);
  const url = `/playground/${generateRandomName()}?fromLink=${encoded}`;
  openLink(url);
}

export function createBoardSrcLink(src: string) {
  const encoded = encodeBoardState(src);
  const current = new URL(window.location.href);
  const url = `${current.pathname}/src?fromLink=${encoded}`;
  openLink(url);
}

export function decodeBoardState(compressedEncoded: string): string {
  /*
  const stillCompressed = new Uint8Array(
    atob(compressedEncoded)
      .split("")
      .map(function (c) {
        return c.charCodeAt(0);
      })
  );
  const inflated = strFromU8(decompressSync(stillCompressed));
  */
  const inflated = atob(compressedEncoded);
  return inflated;
}

function openLink(url: string) {
  window.open(url, "_blank", "rel=noopener noreferrer");
}
