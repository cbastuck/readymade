import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  deleteLibraryBoard,
  isHostLibrary,
  listLibraryBoards,
  loadLibraryBoard,
  saveLibraryBoard,
} from "../boardLibrary";
import {
  PlatformCapabilities,
  PlatformProvider,
} from "../../platform/PlatformContext";
import { BoardDescriptor } from "../../types";
import { localStoragePrefix } from "../../views/playground/common";

/**
 * Where the saved boards are, as the views that list and save them see it.
 *
 * The mobile apps keep boards in a library of their own (iCloud Drive or the
 * app's storage). A view that read the page's storage instead would list
 * boards the person does not have and lose the ones they save — so a view
 * never chooses, the library does.
 */

const BOARD: BoardDescriptor = {
  runtimes: [],
  services: {},
  description: "Tunes in the morning",
} as unknown as BoardDescriptor;

function withCapabilities(capabilities: PlatformCapabilities) {
  render(
    <PlatformProvider value={capabilities}>
      <div />
    </PlatformProvider>,
  );
}

function hostLibrary() {
  const boards = new Map<string, BoardDescriptor>();
  const capabilities: PlatformCapabilities = {
    listSavedBoards: async () =>
      [...boards.keys()].map((name) => ({ name, modified: "2026-10-26T10:00:00Z" })),
    loadSavedBoard: async (name) => boards.get(name) ?? null,
    saveSavedBoard: async (name, board) => {
      boards.set(name, board);
    },
    deleteSavedBoard: async (name) => {
      boards.delete(name);
    },
  };
  return { boards, capabilities };
}

describe("the board library", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => withCapabilities({}));

  it("keeps boards in the host's library when the host has one", async () => {
    const { boards, capabilities } = hostLibrary();
    withCapabilities(capabilities);

    await saveLibraryBoard("Morning radio", BOARD);

    expect(isHostLibrary()).toBe(true);
    expect(boards.get("Morning radio")?.boardName).toBe("Morning radio");
    expect(await listLibraryBoards()).toEqual([
      { name: "Morning radio", modified: "2026-10-26T10:00:00Z" },
    ]);
    expect((await loadLibraryBoard("Morning radio"))?.description).toBe(
      "Tunes in the morning",
    );
    expect(localStorage.length).toBe(0);

    await deleteLibraryBoard("Morning radio");
    expect(await listLibraryBoards()).toEqual([]);
  });

  it("keeps boards in the page's storage on a host without one", async () => {
    withCapabilities({});

    await saveLibraryBoard("Morning radio", BOARD);

    expect(isHostLibrary()).toBe(false);
    expect(localStorage.getItem(`${localStoragePrefix}Morning radio`)).not.toBeNull();
    const [listed] = await listLibraryBoards();
    expect(listed.name).toBe("Morning radio");
    expect(listed.description).toBe("Tunes in the morning");
    expect((await loadLibraryBoard("Morning radio"))?.boardName).toBe(
      "Morning radio",
    );

    await deleteLibraryBoard("Morning radio");
    expect(await listLibraryBoards()).toEqual([]);
  });

  it("is not the host's library unless the host keeps the whole of it", () => {
    const { capabilities } = hostLibrary();
    // A host that can load and save by name, but not list or remove — the
    // desktop, whose own views list boards through its backend.
    withCapabilities({
      loadSavedBoard: capabilities.loadSavedBoard,
      saveSavedBoard: capabilities.saveSavedBoard,
    });

    expect(isHostLibrary()).toBe(false);
  });
});
