import { hostBoardLibrary } from "../platform/PlatformContext";
import type { BoardDescriptor } from "../types";
import {
  getLocalBoard,
  getLocalBoards,
  localStoragePrefix,
  storeBoardToLocalStorage,
} from "../views/playground/common";

/**
 * The saved boards, wherever this host keeps them: the host's own library
 * when it has one (the native apps, on disk or in iCloud Drive), local
 * storage otherwise (the web).
 *
 * The point is that a view never decides this itself. A view that read local
 * storage while its host saved somewhere else would list boards that are not
 * the ones the person has, and lose the ones they save.
 */

export type LibraryBoard = {
  name: string;
  /** Last write, ISO 8601, where the store knows it. */
  modified?: string;
  /** Known up front only where the store keeps it beside the board. */
  description?: string;
};

export async function listLibraryBoards(): Promise<LibraryBoard[]> {
  const host = hostBoardLibrary();
  if (host) {
    return host.listSavedBoards();
  }
  return getLocalBoards().map((board) => ({
    name: board.name,
    modified: board.createdAt,
    description: board.description,
  }));
}

export async function loadLibraryBoard(
  name: string,
): Promise<BoardDescriptor | null> {
  const host = hostBoardLibrary();
  if (host) {
    return host.loadSavedBoard(name);
  }
  return getLocalBoard(name) ?? null;
}

/** Saves `board` under `name`, which it is also given as its `boardName`. */
export async function saveLibraryBoard(
  name: string,
  board: BoardDescriptor,
): Promise<void> {
  const named = { ...board, boardName: name };
  const host = hostBoardLibrary();
  if (host) {
    await host.saveSavedBoard(name, named);
    return;
  }
  storeBoardToLocalStorage(
    name,
    JSON.stringify({ ...named, name }),
    board.description,
  );
}

export async function deleteLibraryBoard(name: string): Promise<void> {
  const host = hostBoardLibrary();
  if (host) {
    await host.deleteSavedBoard(name);
    return;
  }
  localStorage.removeItem(`${localStoragePrefix}${name}`);
}

/** Whether boards are kept by the host rather than in this page's storage. */
export function isHostLibrary(): boolean {
  return hostBoardLibrary() !== null;
}
