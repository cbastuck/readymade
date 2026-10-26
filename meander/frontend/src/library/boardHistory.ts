import { BoardSnapshot } from "hkp-frontend/src/core/boardSnapshots";
import { BoardDescriptor } from "hkp-frontend/src/types";

import { getBackend } from "../backend";
import { BoardHistoryEntry } from "../backend/types";

/**
 * A board's history, as every native host keeps it: the snapshots taken as the
 * board was edited (hkp://history/), and which board was last worked on, so
 * the app can offer to continue it. Shared by the desktop and the mobile apps.
 */

const LAST_BOARD_KEY = "lastActiveBoardName";
const LAST_LIBRARY_KEY = "lastActiveBoardLibrary";

/**
 * Which library a board is kept in: the host's own, or — on a Mac — the iOS
 * app's iCloud Drive folder (hkp://shared-boards/). It decides where the board
 * is read from when it is continued, and where saving writes it.
 */
export type BoardLibraryKind = "local" | "icloud";

/** The board last worked on, if any. */
export function lastBoardName(): string | null {
  return localStorage.getItem(LAST_BOARD_KEY);
}

/** The library the board last worked on is kept in. */
export function lastBoardLibrary(): BoardLibraryKind {
  return localStorage.getItem(LAST_LIBRARY_KEY) === "icloud" ? "icloud" : "local";
}

export function rememberLastBoard(
  name: string,
  library: BoardLibraryKind = "local",
): void {
  localStorage.setItem(LAST_BOARD_KEY, name);
  localStorage.setItem(LAST_LIBRARY_KEY, library);
}

/**
 * Adds a snapshot to its board's history, and makes the board the one to
 * continue. `fallbackName` names a board the snapshot does not name itself.
 */
export async function recordSnapshot(
  snapshot: BoardSnapshot,
  fallbackName?: string,
  library: BoardLibraryKind = "local",
): Promise<void> {
  const { documents, reason } = snapshot;
  const name = snapshot.boardName || fallbackName;
  if (!name) {
    return;
  }
  rememberLastBoard(name, library);
  // The documents, not the projection: a board is resumed by being opened,
  // and what is opened has to be a document. Stored flat, a composition comes
  // back declaring no units, so there is nothing left to link and the facades
  // its units contribute are gone — the board is there, its faces are not.
  //
  // A configuration snapshot is labelled apart so the history keeps one of
  // them in a row rather than fifty: the backend replaces a "config" entry at
  // the head with the next one, and a structural change starts a new entry.
  const entry: BoardHistoryEntry = {
    timestamp: new Date().toISOString(),
    label: reason === "configuration" ? "config" : "auto",
    snapshot: { ...documents.composition, boardName: name },
    ...(documents.units.length ? { units: documents.units } : {}),
  };
  try {
    await (await getBackend()).pushBoardSnapshot(name, entry);
  } catch {
    // Non-critical: history push failures are silently ignored.
  }
}

/** A board to open from its history: the board, and the unit documents it was
 *  stored with. */
export type ResumedBoard = {
  board: BoardDescriptor;
  units?: Record<string, BoardDescriptor>;
};

export function resumedFrom(entry: BoardHistoryEntry): ResumedBoard {
  // A composition is stored as a composition, so it has to be linked again
  // to run — and these are the only documents left to link it from.
  const units = entry.units?.length
    ? Object.fromEntries(entry.units.map((unit) => [unit.uri, unit.board]))
    : undefined;
  return { board: entry.snapshot, units };
}

/** `name` as it was last seen: its latest snapshot, or the saved board when it
 *  has no history. */
export async function resumeBoard(
  name: string,
  library: BoardLibraryKind = "local",
): Promise<ResumedBoard | undefined> {
  const backend = await getBackend();
  try {
    const history = await backend.loadBoardHistory(name);
    if (history.length > 0) {
      return resumedFrom(history[0]);
    }
  } catch {}
  try {
    return {
      board:
        library === "icloud" && backend.loadSharedBoard
          ? await backend.loadSharedBoard(name)
          : await backend.loadBoard(name),
    };
  } catch {}
  return undefined;
}
