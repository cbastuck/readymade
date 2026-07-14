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
import { useCloudLogin } from "hkp-frontend/src/auth/useCloudLogin";
import { useCloudLogout } from "hkp-frontend/src/auth/useCloudLogout";
import { getBackend } from "./backend";
import { isMeanderApp } from "./isMeanderApp";
import { useBackendRemotes } from "./useBackendRemotes";
import LoadBoardDialog from "./LoadBoardDialog";
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
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
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
    async () => (await getBackend()).fetchSavedBoards(),
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
        // No runtime detail view in the desktop app yet.
        break;
    }
  };

  const boardStates = useMemo<Record<string, BoardState>>(
    () => (lastSessionName ? { [lastSessionName]: "recent" } : {}),
    [lastSessionName],
  );

  const currentVersion = splitBuildVersion(__READYMADE_BUILD_VERSION__);

  return (
    <>
      <SharedStartPage
        store={store}
        listSavedBoards={listSavedBoards}
        boardStates={boardStates}
        onOpen={handleOpen}
        onCreateBoard={() => onRestoreBoard(undefined)}
        onCreateNamedBoard={(name) => void handleCreateNamedBoard(name)}
        recentBoardName={lastSessionName}
        onContinueRecent={() => void handleResume()}
        onLoadBoard={() => setIsLoadDialogOpen(true)}
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
      <LoadBoardDialog
        visible={isLoadDialogOpen}
        onSetVisible={setIsLoadDialogOpen}
        onBoardLoaded={(board) => onRestoreBoard(board)}
      />
    </>
  );
}
