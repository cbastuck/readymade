import { useRef, useState } from "react";
import { Send } from "lucide-react";

import CustomDialog from "hkp-frontend/src/ui-components/CustomDialog";
import Button from "hkp-frontend/src/ui-components/Button";
import BoardWidget, {
  BoardWidgetAPI,
} from "hkp-frontend/src/components/BoardWidget";
import { BoardDescriptor, User } from "hkp-frontend/src/types";
import { restoreBoardFromLocalStorage } from "../playground/common";
import SearchableSelect from "hkp-frontend/src/ui-components/SearchableSelect";

type Props = {
  user: User | null;
  sourceBoard: string | null;
  targetBoards: Array<string> | null;
  selectedBoard: string | null;
  onClose: () => void;
  onSelectionChanged: (board: string) => void;
};

export default function PostBoardDialog({
  user,
  sourceBoard,
  targetBoards,
  selectedBoard,
  onClose,
  onSelectionChanged,
}: Props) {
  const [loadedBoard, setLoadedBoard] = useState<BoardDescriptor | null>(null);
  const [selectedTargetBoard, setSelectedTargetBoard] = useState<string | null>(
    null
  );
  const onSelectBoard = async (value: string) => {
    const b = restoreBoardFromLocalStorage(value);
    if (b) {
      setSelectedTargetBoard(value);
      setLoadedBoard(b);
      onSelectionChanged(value);
    }
  };

  const apiRef = useRef<BoardWidgetAPI | null>(null);
  const onPostBoard = () => {
    if (sourceBoard) {
      const source = restoreBoardFromLocalStorage(sourceBoard);
      if (source) {
        apiRef.current?.runBoard(source);
      }
    }
  };

  return (
    <CustomDialog isOpen={targetBoards !== null} onOpenChange={onClose}>
      <div className="flex flex-col overflow-hidden">
        <SearchableSelect
          className="w-[300px]"
          title={
            <div className="flex whitespace-nowrap items-center">
              Post{" "}
              <pre className="bg-gray-100 rounded p-1 mx-2">{sourceBoard}</pre>{" "}
              source to
            </div>
          }
          label="Select Target"
          value={selectedTargetBoard || ""}
          options={targetBoards || []}
          onSelect={onSelectBoard}
        >
          <Button
            className="w-[100%] text-base"
            onClick={onPostBoard}
            disabled={!selectedTargetBoard}
          >
            Process <Send className="ml-2" size="18" />
          </Button>
        </SearchableSelect>

        {loadedBoard && selectedBoard && (
          <div className="border-gray border my-2 p-10 w-full h-full max-h-[400px] overflow-y-auto">
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
      </div>
    </CustomDialog>
  );
}
