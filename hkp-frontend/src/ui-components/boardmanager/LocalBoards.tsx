import { useEffect, useState } from "react";

import {
  localStoragePrefix,
  getLocalBoards,
  removeLocalBoard,
} from "../../views/playground/common";

import { SavedBoard } from "../../types";

import { BoardManagerAction } from "hkp-frontend/src/ui-components/boardmanager/BoardTable";
import BoardManager from ".";

export default function LocalBoards() {
  const [savedBoards, setSavedBoards] = useState<Array<SavedBoard>>([]);
  useEffect(() => setSavedBoards(getLocalBoards(localStoragePrefix)), []);

  const onAction = (board: SavedBoard, { command }: BoardManagerAction) => {
    if (command === "delete") {
      removeLocalBoard(board);
      setSavedBoards(getLocalBoards(localStoragePrefix));
    }
  };

  return (
    <BoardManager
      title="Local Boards"
      boards={savedBoards}
      onAction={onAction}
    />
  );
}
