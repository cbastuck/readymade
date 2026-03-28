import {
  Dialog,
  DialogContent,
} from "hkp-frontend/src/ui-components/primitives/dialog";

import { useContext } from "react";
import { Trash } from "lucide-react";

import { BoardCtx } from "hkp-frontend/src/BoardContext";

import { loadBoard } from "./actions";
import Button from "hkp-frontend/src/ui-components/Button";
import { BoardDescriptor } from "hkp-frontend/src/types";

type Props = {
  visible: boolean;
  items: Array<string>;
  onSetVisible: (visible: boolean) => void;
  onDeleteBoard: (saveName: string) => Promise<void>;
  onBoardLoaded?: (board: BoardDescriptor) => void;
};

export default function LoadBoardDialog({
  visible,
  items,
  onSetVisible,
  onDeleteBoard,
  onBoardLoaded,
}: Props) {
  const avoidDefaultDomBehavior = (e: Event) => {
    e.preventDefault();
  };

  const boardContext = useContext(BoardCtx);
  const onLoadSavedBoard = async (item: string) => {
    const board = await loadBoard(item);
    boardContext?.setBoardState(board);
    return board;
  };

  const onLoad = async (item: string) => {
    const board = await onLoadSavedBoard(item);
    onSetVisible(false);
    if (onBoardLoaded) {
      onBoardLoaded(board);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <Dialog open={visible} onOpenChange={onSetVisible}>
      <DialogContent
        className="sm:max-w-[80%] h-[80%] flex flex-col overflow-scroll"
        onPointerDownOutside={avoidDefaultDomBehavior}
        onInteractOutside={avoidDefaultDomBehavior}
      >
        <h2>Select a Board</h2>
        {items.map((item, idx) => (
          <div
            key={`{${item}.${idx}`}
            className="py-4 px-10 border-b border-gray-200 hover:bg-gray-100 cursor-pointer flex flex-row"
            onClick={() => onLoad(item)}
          >
            <div className="text-lg font-semibold">{item}</div>
            <Button
              className="ml-auto"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteBoard(item);
              }}
            >
              <Trash className="ml-auto"></Trash>
            </Button>
          </div>
        ))}
      </DialogContent>
    </Dialog>
  );
}
