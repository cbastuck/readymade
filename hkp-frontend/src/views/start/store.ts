import { normalizeStartPageTree } from "./model";
import { StartPageTree } from "./types";

/**
 * Persistence seam for the start-page folder tree. The Meander desktop app
 * backs this with a JSON file via the hkp:// scheme; browsers fall back to
 * localStorage until the website gains cloud persistence.
 */
export interface StartPageStore {
  load(): Promise<StartPageTree | null>;
  save(tree: StartPageTree): Promise<void>;
}

export function localStorageStartPageStore(
  key = "hkp-startpage-tree",
): StartPageStore {
  return {
    async load() {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return null;
      }
      try {
        return normalizeStartPageTree(JSON.parse(raw));
      } catch {
        return null;
      }
    },
    async save(tree: StartPageTree) {
      localStorage.setItem(key, JSON.stringify(tree));
    },
  };
}
