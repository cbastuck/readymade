import { useRef, useState } from "react";
import CustomDialog from "@/ui-components/CustomDialog";
import SelectorField, {
  arrayToOptions,
} from "@/components/shared/SelectorField";
import Button from "@/ui-components/Button";
import BoardWidget, { BoardWidgetAPI } from "@/components/BoardWidget";
import { BoardDescriptor, User } from "@/types";
import { restoreBoardFromLocalStorage } from "../playground/common";

type Props = {
  user: User | null;
  boards: Array<string> | null;
  selectedBoard: string | null;
  value?: any;
  onClose: () => void;
  onSelectionChanged: (board: string) => void;
};

export default function PostBoardDialog({
  user,
  boards,
  selectedBoard,

  onClose,
  onSelectionChanged,
}: Props) {
  const [loadedBoard, setLoadedBoard] = useState<BoardDescriptor | null>(null);
  const onSelectBoard = async (item: { value: string }) => {
    const b = restoreBoardFromLocalStorage(item.value);
    if (b) {
      setLoadedBoard(b);
      onSelectionChanged(item.value);
    }
  };

  const apiRef = useRef<BoardWidgetAPI | null>(null);
  const onPostBoard = () => {
    apiRef.current?.runBoard(loadedBoard);
  };

  return (
    <CustomDialog isOpen={boards !== null} onOpenChange={onClose}>
      <div className="flex flex-col">
        <SelectorField
          className="whitespace-nowrap p-4 w-full"
          label="Target Board"
          options={boards ? arrayToOptions(boards!) : {}}
          onChange={onSelectBoard}
          value={selectedBoard}
        />
        {loadedBoard && selectedBoard && (
          <div className="border-gray border p-10 w-full h-full max-h-[400px] overflow-y-auto">
            <BoardWidget
              apiRef={apiRef}
              user={user}
              board={loadedBoard}
              title={selectedBoard}
              boardHiddenOnInit={false}
              runBoardAfterLoad={false}
            >
              {({ result }) => <div>{JSON.stringify(result)}</div>}
            </BoardWidget>
          </div>
        )}
        <Button className="my-4" onClick={onPostBoard}>
          Post Board
        </Button>
      </div>
    </CustomDialog>
  );
}
