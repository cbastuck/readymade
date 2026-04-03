import { useCallback, useEffect, useMemo, useState } from "react";

import HkpApp from "hkp-frontend/src/App";
import Playground from "hkp-frontend/src/views/playground";

import { Remote } from "./types";
import {
  getRemotes,
  saveBoard,
  createMenuItems,
  deleteBoard,
  deleteRemote,
  fetchSavedBoards,
  loadBoard,
  saveRemote,
} from "./actions";
import Board from "./Board";
import { BoardContextState } from "hkp-frontend/src/BoardContext";
import {
  BoardDescriptor,
  isRuntimeGraphQLClassType,
  isRuntimeRestClassType,
  RuntimeClass,
} from "hkp-frontend/src/types";

const isBuiltInRemote = (url?: string) =>
  (url || "").startsWith("hkp://remotes/");

function App() {
  const [boardName, setBoardName] = useState("Idea");
  const [remotes, setRemotes] = useState<Array<Remote> | null>(null);
  const [loadBoardItems, setLoadBoardItems] = useState<Array<string> | null>(
    null,
  );

  const [boardSource, setBoardSource] = useState("");

  const loadRemotes = useCallback(async () => {
    setRemotes(await getRemotes());
  }, []);

  useEffect(() => {
    loadRemotes();
  }, [loadRemotes]);

  const availableRuntimeEngines = useMemo(() => {
    return [
      {
        type: "browser",
        name: "Browser Runtime",
      },
      ...(remotes || []).map((remote: Remote) => {
        return {
          type: "rest",
          name: remote.name,
          url: remote.url,
          color: remote.color,
          description: isBuiltInRemote(remote.url)
            ? `Local runtime proxy at ${remote.url}`
            : `Runtime engine at ${remote.url}${remote.port ? ` with port ${remote.port}` : ""}`,
        };
      }),
    ];
  }, [remotes]);

  const syncAvailableRuntimeEngines = useCallback(
    async (runtimeClasses: Array<RuntimeClass>) => {
      const currentRemotes = (remotes || []).filter(
        (remote) => !isBuiltInRemote(remote.url),
      );

      const desiredRemotes: Array<Remote> = runtimeClasses
        .filter(
          (runtime) =>
            (isRuntimeGraphQLClassType(runtime.type) ||
              isRuntimeRestClassType(runtime.type)) &&
            !isBuiltInRemote(runtime.url),
        )
        .map((runtime) => {
          const existingRemote = currentRemotes.find(
            (remote) => remote.name === runtime.name,
          );

          return {
            name: runtime.name,
            url: runtime.url || "",
            port: existingRemote?.port || 0,
            color: runtime.color,
          };
        });

      const desiredNames = new Set(desiredRemotes.map((remote) => remote.name));
      const removedRemotes = currentRemotes.filter(
        (remote) => !desiredNames.has(remote.name),
      );

      await Promise.all(desiredRemotes.map((remote) => saveRemote(remote)));
      await Promise.all(
        removedRemotes.map((remote) => deleteRemote(remote.name)),
      );
      await loadRemotes();
    },
    [loadRemotes, remotes],
  );

  const onCloseBoardSource = () => setBoardSource("");

  const menuItemFactory = useMemo(
    () => createMenuItems(setLoadBoardItems, setBoardSource),
    [],
  );

  const onChangeLoadDialogVisibility = (visible: boolean) => {
    if (!visible) {
      setLoadBoardItems(null);
    }
  };
  const onUpdatedBoard = (ctx: BoardContextState) =>
    setBoardName((boardName) => ctx.boardName || boardName);

  const onNewBoard = (ctx: BoardContextState) => {
    const newBoardName = "New Idea";
    setBoardName(newBoardName);
    ctx.clearBoard(newBoardName);
  };

  const onDeleteBoard = async (saveName: string) => {
    await deleteBoard(saveName);
    setLoadBoardItems(await fetchSavedBoards());
  };

  const onClearBoard = async (_, newBoardName: string) => {
    setBoardName(newBoardName);
  };

  const onSaveBoard = async (name: string, payload: BoardDescriptor) => {
    saveBoard(name, payload);
    setBoardName(name);
  };

  const [restoredRecentBoard, setRestoredRecentBoard] =
    useState<BoardDescriptor | null>(null);
  const restoreRecentBoard = async () => {
    const lastBoardName = localStorage.getItem("recentlyLoadedBoard");
    if (lastBoardName) {
      const savedBoardNames = await fetchSavedBoards();
      const savedBoard = savedBoardNames.find(
        (boardName) => boardName === lastBoardName,
      );
      if (savedBoard) {
        const board = await loadBoard(savedBoard);
        setRestoredRecentBoard(board);
      }
    }
  };

  useEffect(() => {
    restoreRecentBoard();
  }, []);

  const onBoardLoaded = (board: BoardDescriptor) => {
    if (board.boardName) {
      localStorage.setItem("recentlyLoadedBoard", board.boardName);
    }
  };

  return (
    <HkpApp>
      <Playground
        boardDescriptor={restoredRecentBoard}
        boardName={boardName}
        availableRuntimeEngines={availableRuntimeEngines}
        onUpdateAvailableRuntimeEngines={syncAvailableRuntimeEngines}
        onSaveBoard={onSaveBoard}
        onNewBoard={onNewBoard}
        onClearBoard={onClearBoard}
        onChangeBoardname={setBoardName}
        onUpdateBoardState={onUpdatedBoard}
        menuItemFactory={menuItemFactory}
        hideNavigation
      >
        <Board
          boardSource={boardSource}
          loadBoardItems={loadBoardItems}
          onCloseBoardSource={onCloseBoardSource}
          onChangeLoadDialogVisibility={onChangeLoadDialogVisibility}
          onDeleteBoard={onDeleteBoard}
          onBoardLoaded={onBoardLoaded}
        />
      </Playground>
    </HkpApp>
  );
}

export default App;
