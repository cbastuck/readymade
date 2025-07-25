import {
  Dialog,
  DialogContent,
} from "hkp-frontend/src/ui-components/primitives/dialog";

import { useContext } from "react";
import { Trash } from "lucide-react";

import { BoardCtx } from "hkp-frontend/src/BoardContext";
import { SavedBoardDescriptor } from "./types";
import { loadBoard } from "./actions";
import Button from "hkp-frontend/src/ui-components/Button";

type Props = {
  visible: boolean;
  items: Array<SavedBoardDescriptor>;
  onSetVisible: (visible: boolean) => void;
  onDeleteBoard: (saveName: string) => Promise<void>;
};

export default function LoadBoardDialog({
  visible,
  items,
  onSetVisible,
  onDeleteBoard,
}: Props) {
  const avoidDefaultDomBehavior = (e: Event) => {
    e.preventDefault();
  };

  const boardContext = useContext(BoardCtx);
  const onLoadSavedBoard = async (item: SavedBoardDescriptor) => {
    boardContext?.setBoardState(await loadBoard(item));
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
            key={`{${item.name}.${idx}`}
            className="py-4 px-10 border-b border-gray-200 hover:bg-gray-100 cursor-pointer flex flex-row"
            onClick={() => {
              onLoadSavedBoard(item);
              onSetVisible(false);
            }}
          >
            <div className="text-lg font-semibold">{item.name}</div>
            <Button
              className="ml-auto"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteBoard(item.name);
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
