import { BoardDescriptor } from "hkp-frontend/src/types";
import { Remote } from "../types";
import { BackendAdapter } from "./types";

/**
 * Backend implementation for the Meander desktop app.
 * Uses the hkp:// custom scheme registered by the native webview.
 */
export const meanderBackend: BackendAdapter = {
  async fetchSavedBoards(): Promise<Array<string>> {
    const res = await fetch("hkp://boards/");
    const boardNames: Array<string> = await res.json();
    return boardNames.map((name) => decodeURIComponent(name));
  },

  async loadBoard(boardName: string): Promise<BoardDescriptor> {
    const res = await fetch(`hkp://boards/${boardName}`);
    if (!res.ok) throw new Error(`Failed to load board: ${res.statusText}`);
    const board = await res.json();
    return board.boardName ? board : { ...board, boardName };
  },

  async saveBoard(name: string, payload: BoardDescriptor): Promise<void> {
    const res = await fetch(`hkp://boards/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to save board: ${res.statusText}`);
  },

  async deleteBoard(name: string): Promise<void> {
    const res = await fetch(`hkp://boards/${name}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Failed to delete board: ${res.statusText}`);
  },

  async getRemotes(): Promise<Array<Remote>> {
    const res = await fetch("hkp://remotes/");
    return res.json();
  },

  async saveRemote(remote: Remote): Promise<void> {
    const res = await fetch("hkp://remotes/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(remote),
    });
    if (!res.ok) throw new Error(`Failed to save remote: ${res.statusText}`);
  },

  async deleteRemote(name: string): Promise<void> {
    const res = await fetch("hkp://remotes/", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`Failed to delete remote: ${res.statusText}`);
  },
};
