import { BoardDescriptor } from "hkp-frontend/src/types";
import { Remote } from "../types";

export type BoardHistoryEntry = {
  timestamp: string; // ISO 8601
  label: "auto" | "manual";
  snapshot: BoardDescriptor;
};

export type HistoryBoardSummary = {
  name: string;
  latestTimestamp?: string; // ISO 8601
};

export type PickerOptions = {
  initial?: string;
  filters?: string[];
};

export interface BackendAdapter {
  // Boards
  fetchSavedBoards(): Promise<Array<string>>;
  loadBoard(boardName: string): Promise<BoardDescriptor>;
  saveBoard(name: string, payload: BoardDescriptor): Promise<void>;
  deleteBoard(name: string): Promise<void>;

  // Remotes
  getRemotes(): Promise<Array<Remote>>;
  saveRemote(remote: Remote): Promise<void>;
  deleteRemote(name: string): Promise<void>;

  // Board history
  fetchHistoryBoards(): Promise<Array<HistoryBoardSummary>>;
  pushBoardSnapshot(boardName: string, entry: BoardHistoryEntry): Promise<void>;
  loadBoardHistory(boardName: string): Promise<Array<BoardHistoryEntry>>;
  clearBoardHistory(boardName: string): Promise<void>;

  // File picker (native desktop only; returns null in browser or when cancelled)
  pickFile(options?: PickerOptions): Promise<string | null>;
  pickFolder(options?: PickerOptions): Promise<string | null>;
  pickSavePath(options?: PickerOptions): Promise<string | null>;

  // Native file I/O (desktop only; throws in browser)
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
}
