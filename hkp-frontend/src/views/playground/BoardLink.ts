import { generateRandomName } from "../../core/board";
import * as lzstring from "lz-string";

export function encodeBoardState(src: string) {
  return lzstring.compressToEncodedURIComponent(src);
}

export function createBoardLink(src: string) {
  const encoded = encodeBoardState(src);
  const url = `${
    window.location.origin
  }/playground/${generateRandomName()}?fromLink=${encoded}`;
  return url;
}

export function createBoardSrcLink(src: string) {
  const encoded = encodeBoardState(src);
  const current = new URL(window.location.href);
  const url = `${current.pathname}/src?fromLink=${encoded}`;
  openLink(url);
}

export function decodeBoardState(compressedEncoded: string): string {
  return lzstring.decompressFromEncodedURIComponent(
    decodeURIComponent(compressedEncoded)
  );
}

function openLink(url: string) {
  window.open(url, "_blank", "rel=noopener noreferrer");
}
