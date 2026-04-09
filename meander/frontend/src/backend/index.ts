import { isMeanderApp } from "../isMeanderApp";
import { meanderBackend } from "./meander";
import { browserBackend } from "./browser";
import { BackendAdapter } from "./types";

export type { BackendAdapter };

export function getBackend(): BackendAdapter {
  return isMeanderApp() ? meanderBackend : browserBackend;
}
