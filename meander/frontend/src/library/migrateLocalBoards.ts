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
 * so a failure part-way leaves every board in exactly one place and the next
 * launch carries on where this one stopped. A name the library already has —
 * a unit saved by name went there all along — gets the next free "name (n)".
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
      let name = board.name;
      for (let i = 2; taken.has(name); i++) {
        name = `${board.name} (${i})`;
      }
      try {
        await backend.saveBoard(name, {
          ...descriptor,
          boardName: name,
          description: descriptor.description ?? board.description,
        });
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
