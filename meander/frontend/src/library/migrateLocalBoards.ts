import { localStorageStartPageStore } from "hkp-frontend/src/views/start";
import {
  getLocalBoard,
  getLocalBoards,
} from "hkp-frontend/src/views/playground/common";
import { BoardDescriptor } from "hkp-frontend/src/types";

import { getBackend } from "../backend";

/**
 * Moves the boards the mobile app kept in the webview's local storage into the
 * app's own library (hkp://boards/), once. Before this, boards saved on a
 * phone lived where iOS may clear them and nothing else can see them.
 *
 * A board is removed from local storage only once its copy is in the library,
 * so a failure part-way loses nothing and the next launch carries on where
 * this one stopped. A name the library already has — a unit saved by name
 * went there all along — gets the next free "name (n)", unless the board it
 * names is this one: an app stopped between saving a board and removing it
 * left it in both places, and the copy in local storage is then only removed.
 *
 * The finder's folder tree comes along when the library has none yet.
 */
export async function migrateLocalBoards(): Promise<void> {
  const local = getLocalBoards();
  const backend = await getBackend();

  if (local.length > 0) {
    const taken = new Set(await backend.fetchSavedBoards());
    for (const board of local) {
      const descriptor = getLocalBoard(board.name) as BoardDescriptor | undefined;
      if (!descriptor) {
        continue;
      }
      const documentNamed = (name: string): BoardDescriptor => ({
        ...descriptor,
        boardName: name,
        description: descriptor.description ?? board.description,
      });
      let name = board.name;
      let movedAlready = false;
      for (let i = 2; taken.has(name); i++) {
        if (await libraryHolds(name, documentNamed(name))) {
          movedAlready = true;
          break;
        }
        name = `${board.name} (${i})`;
      }
      if (movedAlready) {
        localStorage.removeItem(board.id);
        continue;
      }
      try {
        await backend.saveBoard(name, documentNamed(name));
      } catch (err) {
        console.error(`Could not move “${board.name}” into the library`, err);
        continue;
      }
      taken.add(name);
      localStorage.removeItem(board.id);
    }
  }

  const localTree = localStorageStartPageStore();
  const tree = await localTree.load();
  if (tree && !(await backend.loadStartPageTree())) {
    await backend.saveStartPageTree(tree);
  }
}

/** Whether the library's board `name` is `document`, however its store spells it. */
async function libraryHolds(
  name: string,
  document: BoardDescriptor,
): Promise<boolean> {
  try {
    const stored = await (await getBackend()).loadBoard(name);
    return JSON.stringify(canonical(stored)) === JSON.stringify(canonical(document));
  } catch {
    return false;
  }
}

/** A value with its object keys in order, and nothing JSON would not keep. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}
