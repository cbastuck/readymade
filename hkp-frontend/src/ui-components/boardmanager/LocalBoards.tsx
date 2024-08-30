import { useEffect, useState } from "react";

import {
  localStoragePrefix,
  getLocalBoards,
  removeLocalBoard,
} from "../../views/playground/common";

import { SavedBoard } from "../../types";

import { BoardManagerAction } from "@/ui-components/boardmanager/BoardTable";
import BoardManager from ".";

type Props = {};

export default function LocalBoards({}: Props) {
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
