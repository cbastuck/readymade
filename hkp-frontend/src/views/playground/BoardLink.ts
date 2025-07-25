import {
  decompressAndDecodeState,
  compressAndEncodeState,
} from "hkp-frontend/src/common";
import { generateRandomName } from "../../core/board";

export function encodeBoardState(src: string) {
  return compressAndEncodeState(src);
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
  return decompressAndDecodeState(compressedEncoded);
}

function openLink(url: string) {
  window.open(url, "_blank", "rel=noopener noreferrer");
}
