import { useEffect, useMemo, useState } from "react";

import HkpApp from "hkp-frontend/src/App";
import Playground from "hkp-frontend/src/views/playground";

import { Remote, SavedBoardDescriptor } from "./types";
import {
  getRemotes,
  saveBoard,
  createMenuItems,
  deleteBoard,
  fetchSavedBoards,
} from "./actions";
import Board from "./Board";
import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { BoardDescriptor } from "hkp-frontend/src/types";

function App() {
  const [boardName, setBoardName] = useState("Idea");
  const [remotes, setRemotes] = useState<any>(null);
  const [loadBoardItems, setLoadBoardItems] =
    useState<Array<SavedBoardDescriptor> | null>(null);

  const [boardSource, setBoardSource] = useState("");

  useEffect(() => {
    getRemotes().then(setRemotes);
  }, []);

  const availableRuntimeEngines = useMemo(() => {
    return [
      {
        type: "browser",
        name: "Browser Runtime",
      },
      {
        type: "realtime",
        name: "Node.js Runtime",
        url: "http://localhost:3200", // TODO: static URL for demo purposes
      },
      ...(remotes || [])?.map((remote: Remote, idx) => {
        return {
          type: "realtime",
          name: `Remote Runtime ${idx + 1}`,
          url: remote.url,
          description: `Runtime engine at ${remote.url} with port ${remote.port}`,
        };
      }),
    ];
  }, [remotes]);

  const onCloseBoardSource = () => setBoardSource("");

  const menuItemFactory = useMemo(
    () => createMenuItems(setLoadBoardItems, setBoardSource),
    []
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

  return (
    <HkpApp>
      <Playground
        boardName={boardName}
        availableRuntimeEngines={availableRuntimeEngines}
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
        />
      </Playground>
    </HkpApp>
  );
}

export default App;
