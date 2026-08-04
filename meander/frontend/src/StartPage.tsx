import { useCallback, useEffect, useMemo, useState } from "react";

import { BoardDescriptor } from "hkp-frontend/src/types";
import { useAppContext } from "hkp-frontend/src/AppContext";
import { useNavigate } from "hkp-frontend/src/router";
import { findDemoBoard } from "hkp-frontend/src/demoRegistry";
import {
  StartPage as SharedStartPage,
  StartPageStore,
  BoardAction,
  BoardHistoryItem,
  BoardState,
  createEmptyBoard,
  initialsOf,
  splitBuildVersion,
} from "hkp-frontend/src/views/start";
import { forkBoard } from "hkp-frontend/src/core/forkBoard";
import { listCoordinatorBoards } from "hkp-frontend/src/views/cloud/coordinatorClient";
import { useCloudLogin } from "hkp-frontend/src/auth/useCloudLogin";
import { useCloudLogout } from "hkp-frontend/src/auth/useCloudLogout";
import { getBackend } from "./backend";
import { isMeanderApp } from "./isMeanderApp";
import { useBackendRemotes } from "./useBackendRemotes";
import MeanderAppMenu from "./MeanderAppMenu";

type Props = {
  onRestoreBoard: (board: BoardDescriptor | null | undefined) => void;
};

export default function StartPage({ onRestoreBoard }: Props) {
  const { user } = useAppContext();
  const cloudLogin = useCloudLogin();
  const cloudLogout = useCloudLogout();
  const navigate = useNavigate();
  const remotes = useBackendRemotes();
  const [lastSessionName, setLastSessionName] = useState<string | null>(null);
  const [inApp, setInApp] = useState(false);

  useEffect(() => {
    setLastSessionName(localStorage.getItem("lastActiveBoardName"));
    void isMeanderApp().then(setInApp);
  }, []);

  // Persisted via hkp://startpage in the desktop app (startpage.json next to
  // the saved boards), localStorage in a plain browser.
  const store = useMemo<StartPageStore>(
    () => ({
      load: async () => (await getBackend()).loadStartPageTree(),
      save: async (tree) => (await getBackend()).saveStartPageTree(tree),
    }),
    [],
  );

  const listSavedBoards = useCallback(
    async () => (await getBackend()).fetchSavedBoardEntries(),
    [],
  );

  const listBoardHistory = useCallback(
    async (name: string): Promise<BoardHistoryItem[]> => {
      const backend = await getBackend();
      const entries = await backend.loadBoardHistory(name);
      return entries.map((entry) => ({
        timestamp: entry.timestamp,
        label: entry.label,
        open: () => onRestoreBoard(entry.snapshot),
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const describeBoard = useCallback(async (name: string) => {
    try {
      return (await (await getBackend()).loadBoard(name)).description;
    } catch {
      return undefined;
    }
  }, []);

  const deleteBoard = useCallback(async (name: string) => {
    await (await getBackend()).deleteBoard(name);
  }, []);

  const uploadBoardArt = useCallback(
    async (name: string, image: Blob) =>
      (await getBackend()).uploadBoardArt(name, image),
    [],
  );

  // The saucer webview doesn't open a panel for <input type="file">, so pick
  // via the native dialog and pull the bytes through hkp://local-image.
  const pickBoardArtImage = useCallback(async (): Promise<Blob | null> => {
    const backend = await getBackend();
    const picked = await backend.pickFile({
      filters: ["*.jpg", "*.jpeg", "*.png", "*.webp", "*.gif"],
    });
    if (!picked) {
      return null;
    }
    // pickFile returns a file:// URL; the scheme route needs a plain path.
    const path = picked.startsWith("file://")
      ? decodeURIComponent(new URL(picked).pathname)
      : picked;
    const res = await fetch(`hkp://local-image/${encodeURIComponent(path)}`);
    if (!res.ok) {
      throw new Error(`Could not read image: ${res.statusText}`);
    }
    return res.blob();
  }, []);

  const openSavedBoard = async (name: string) => {
    const backend = await getBackend();
    try {
      onRestoreBoard(await backend.loadBoard(name));
    } catch {
      onRestoreBoard(null);
    }
  };

  const handleResume = async () => {
    if (!lastSessionName) {
      return;
    }
    const backend = await getBackend();
    const history = await backend.loadBoardHistory(lastSessionName);
    if (history.length > 0) {
      onRestoreBoard(history[0].snapshot);
      return;
    }
    await openSavedBoard(lastSessionName);
  };

  // Imports a board file picked from disk: saves it under its boardName (a
  // numbered suffix avoids clobbering an existing saved board) and opens it.
  const handleImportBoard = async () => {
    const backend = await getBackend();
    const path = await backend.pickFile({ filters: ["*.hkpp", "*.json"] });
    if (!path) {
      return;
    }
    const source = await backend.readFile(path);
    let board: BoardDescriptor;
    try {
      board = JSON.parse(source) as BoardDescriptor;
    } catch {
      window.alert(`"${path}" is not a valid board file.`);
      return;
    }
    const fileName =
      path
        .split("/")
        .pop()
        ?.replace(/\.(hkpp|json)$/i, "") || "Imported board";
    const name = board.boardName?.trim() || fileName;
    const taken = new Set(await backend.fetchSavedBoards());
    let unique = name;
    for (let i = 2; taken.has(unique); i++) {
      unique = `${name} ${i}`;
    }
    try {
      await backend.saveBoard(unique, { ...board, boardName: unique });
    } catch {
      // Opening still works; the board just isn't on disk yet.
    }
    onRestoreBoard({ ...board, boardName: unique });
  };

  const handleCreateNamedBoard = async (name: string) => {
    const board = createEmptyBoard(name);
    const backend = await getBackend();
    try {
      // Persist right away so the folder reference resolves on return.
      await backend.saveBoard(name, board);
    } catch {
      // Opening still works; the board just isn't on disk yet.
    }
    onRestoreBoard(board);
  };

  /**
   * Forks a deployed board into an editable copy here.
   *
   * The coordinator holds the board's config, so that is what is copied — with
   * every runtime and service id renamed, or the copy would provision over the
   * runtimes the original is running on. The copy is saved and opened; stopping
   * the original and deploying the fork is the user's call, deliberately.
   */
  const handleForkBoard = async (action: {
    coordinatorUrl: string;
    boardName: string;
  }) => {
    if (!user) {
      throw new Error("Log in to fork a cloud board");
    }
    const boards = await listCoordinatorBoards(
      action.coordinatorUrl,
      user.userId,
      user.idToken,
    );
    const source = boards.find((b) => b.boardName === action.boardName);
    if (!source?.config) {
      throw new Error(`"${action.boardName}" has no config to fork`);
    }
    const { board } = forkBoard(source.config as BoardDescriptor);
    const backend = await getBackend();
    const taken = new Set(await backend.fetchSavedBoards());
    let name = board.boardName ?? `${action.boardName} fork`;
    for (let i = 2; taken.has(name); i++) {
      name = `${board.boardName} ${i}`;
    }
    const forked = { ...board, boardName: name };
    try {
      await backend.saveBoard(name, forked);
    } catch {
      // Opening still works; the fork just isn't on disk yet.
    }
    onRestoreBoard(forked);
  };

  const handleOpen = (action: BoardAction) => {
    switch (action.kind) {
      case "saved":
        void openSavedBoard(action.name);
        break;
      case "demo": {
        const board = findDemoBoard(action.slug);
        if (board) {
          onRestoreBoard(board);
        }
        break;
      }
      case "cloud":
        // Open the board in the Cloud Boards view — the same live coordinator
        // session the toolbar icon uses. The state signal tells it which board
        // to select and hydrate on arrival (see CloudBoards' openBoard effect).
        navigate("/cloud-boards", {
          state: {
            openBoard: {
              coordinatorUrl: action.coordinatorUrl,
              boardName: action.boardName,
              at: Date.now(),
            },
          },
        });
        break;
      case "runtime":
        // Watch the runtime live in the attached remote view. Nothing here owns
        // it — the server records no attribution — so that view only ever reads
        // and configures.
        navigate(
          action.runtimeId
            ? `/remotes/${encodeURIComponent(action.remoteName)}/${encodeURIComponent(action.runtimeId)}`
            : `/remotes/${encodeURIComponent(action.remoteName)}`,
        );
        break;
    }
  };

  const boardStates = useMemo<Record<string, BoardState>>(
    () => (lastSessionName ? { [lastSessionName]: "recent" } : {}),
    [lastSessionName],
  );

  const currentVersion = splitBuildVersion(__READYMADE_BUILD_VERSION__);

  return (
    <SharedStartPage
      store={store}
      listSavedBoards={listSavedBoards}
      boardStates={boardStates}
      onOpen={handleOpen}
      forkBoard={handleForkBoard}
      onCreateBoard={() => onRestoreBoard(undefined)}
      onCreateNamedBoard={(name) => void handleCreateNamedBoard(name)}
      recentBoardName={lastSessionName}
      onContinueRecent={() => void handleResume()}
      onLoadBoard={() => void handleImportBoard()}
      loadBoardLabel="Import board"
      describeBoard={describeBoard}
      listBoardHistory={listBoardHistory}
      onDeleteBoard={deleteBoard}
      manageRemotes={remotes}
      withCloudBoards
      uploadBoardArt={uploadBoardArt}
      pickBoardArtImage={inApp ? pickBoardArtImage : undefined}
      excludeDemoTags={["iOS only"]}
      title="Readymade"
      badge={currentVersion.version}
      badgeDetail={currentVersion.hash}
      initials={initialsOf(user?.username)}
      avatarTitle={
        user
          ? user.username
            ? `Log out (${user.username})`
            : "Log out"
          : "Log in"
      }
      onAvatarClick={() => void (user ? cloudLogout() : cloudLogin())}
      menuSlot={<MeanderAppMenu />}
    />
  );
}
