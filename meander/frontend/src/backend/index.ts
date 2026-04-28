import { isMeanderApp } from "../isMeanderApp";
import { meanderBackend } from "./meander";
import { browserBackend } from "./browser";
import { BackendAdapter } from "./types";

export type { BackendAdapter };

export async function getBackend(): Promise<BackendAdapter> {
  return (await isMeanderApp()) ? meanderBackend : browserBackend;
}
