import { BoardDescriptor } from "hkp-frontend/src/types";
import { Remote } from "../types";

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
}
