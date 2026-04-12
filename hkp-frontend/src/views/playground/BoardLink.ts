import {
  decompressAndDecodeState,
  compressAndEncodeState,
} from "hkp-frontend/src/common";
import { generateRandomName } from "../../core/board";
import { getTemplateVarMap } from "hkp-frontend/src/templateVars";

export function encodeBoardState(src: string) {
  return compressAndEncodeState(src);
}

export function createBoardLink(src: string) {
  const encoded = encodeBoardState(src);
  const vars = getTemplateVarMap();
  const origin = vars.HKP_WEBAPP_URL ?? window.location.origin;
  const url = `${origin}/playground/${generateRandomName()}?fromLink=${encoded}`;
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
