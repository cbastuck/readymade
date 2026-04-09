import { BackendAdapter } from "./types";

/**
 * No-op backend for regular browsers where the hkp:// scheme is unavailable.
 * Board and remote persistence simply do nothing / return empty state.
 */
export const browserBackend: BackendAdapter = {
  fetchSavedBoards: async () => [],
  loadBoard: async () => { throw new Error("Board loading is not available in this context"); },
  saveBoard: async () => {},
  deleteBoard: async () => {},
  getRemotes: async () => [],
  saveRemote: async () => {},
  deleteRemote: async () => {},
};
