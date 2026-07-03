import { useCallback, useEffect, useMemo, useState } from "react";

import { BoardDescriptor } from "hkp-frontend/src/types";
import { useAppContext } from "hkp-frontend/src/AppContext";
import { useNavigate } from "hkp-frontend/src/router";
import { findDemoBoard } from "hkp-frontend/src/demoRegistry";
import {
  StartPage as SharedStartPage,
  StartPageStore,
  BoardAction,
  BoardState,
  createEmptyBoard,
  initialsOf,
  splitBuildVersion,
} from "hkp-frontend/src/views/start";
import { getBackend } from "./backend";
import LoadBoardDialog from "./LoadBoardDialog";
import MeanderAppMenu from "./MeanderAppMenu";

type Props = {
  onRestoreBoard: (board: BoardDescriptor | null | undefined) => void;
};

export default function StartPage({ onRestoreBoard }: Props) {
  const { user } = useAppContext();
  const navigate = useNavigate();
  const [lastSessionName, setLastSessionName] = useState<string | null>(null);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);

  useEffect(() => {
    setLastSessionName(localStorage.getItem("lastActiveBoardName"));
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
        navigate("/cloud-boards");
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
        onDeleteBoard={deleteBoard}
        excludeDemoTags={["iOS only"]}
        title="Readymade"
        badge={currentVersion.version}
        badgeDetail={currentVersion.hash}
        initials={initialsOf(user?.username)}
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
