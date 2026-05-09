import { BoardDescriptor } from "hkp-frontend/src/types";
import { Remote } from "../types";
import {
  BackendAdapter,
  BoardHistoryEntry,
  HistoryBoardSummary,
  PickerOptions,
} from "./types";

const encodePathSegment = (value: string) => encodeURIComponent(value);

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
    const res = await fetch(`hkp://boards/${encodePathSegment(boardName)}`);
    if (!res.ok) throw new Error(`Failed to load board: ${res.statusText}`);
    const board = await res.json();
    return board.boardName ? board : { ...board, boardName };
  },

  async saveBoard(name: string, payload: BoardDescriptor): Promise<void> {
    const res = await fetch(`hkp://boards/${encodePathSegment(name)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to save board: ${res.statusText}`);
  },

  async deleteBoard(name: string): Promise<void> {
    const res = await fetch(`hkp://boards/${encodePathSegment(name)}`, {
      method: "DELETE",
    });
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

  async fetchHistoryBoards(): Promise<Array<HistoryBoardSummary>> {
    const res = await fetch("hkp://history/");
    if (!res.ok) return [];
    return res.json();
  },

  async pushBoardSnapshot(
    boardName: string,
    entry: BoardHistoryEntry,
  ): Promise<void> {
    const res = await fetch(`hkp://history/${encodePathSegment(boardName)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (!res.ok)
      throw new Error(`Failed to push board snapshot: ${res.statusText}`);
  },

  async loadBoardHistory(boardName: string): Promise<Array<BoardHistoryEntry>> {
    const res = await fetch(`hkp://history/${encodePathSegment(boardName)}`);
    if (!res.ok) return [];
    return res.json();
  },

  async clearBoardHistory(boardName: string): Promise<void> {
    await fetch(`hkp://history/${encodePathSegment(boardName)}`, {
      method: "DELETE",
    });
  },

  async pickFile(options?: PickerOptions): Promise<string | null> {
    const saucer = (window as any).saucer;
    if (!saucer?.exposed?.pickFile) {
      return null;
    }
    try {
      return await saucer.exposed.pickFile(options ?? {});
    } catch {
      return null;
    }
  },

  async pickFolder(options?: PickerOptions): Promise<string | null> {
    const saucer = (window as any).saucer;
    if (!saucer?.exposed?.pickFolder) {
      return null;
    }
    try {
      return await saucer.exposed.pickFolder(options ?? {});
    } catch {
      return null;
    }
  },

  async pickSavePath(options?: PickerOptions): Promise<string | null> {
    const saucer = (window as any).saucer;
    if (!saucer?.exposed?.pickSavePath) {
      return null;
    }
    try {
      return await saucer.exposed.pickSavePath(options ?? {});
    } catch {
      return null;
    }
  },

  async readFile(path: string): Promise<string> {
    return (window as any).saucer.exposed.readFile(path);
  },

  async writeFile(path: string, content: string): Promise<void> {
    await (window as any).saucer.exposed.writeFile(path, content);
  },
};
