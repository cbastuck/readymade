import EditorDialog from "hkp-frontend/src/ui-components/EditorDialog";
import LoadBoardDialog from "./LoadBoardDialog";
import { useJsApi } from "./hooks";
import { BoardDescriptor } from "hkp-frontend/src/types";

type Props = {
  boardSource?: string;
  loadBoardItems?: Array<string> | null;
  onCloseBoardSource?: () => void;
  onChangeLoadDialogVisibility?: (visible: boolean) => void;
  onDeleteBoard?: (saveName: string) => Promise<void>;
  onBoardLoaded?: (board: BoardDescriptor) => void;
};

export default function Board({
  boardSource,
  loadBoardItems,
  onCloseBoardSource = () => {},
  onChangeLoadDialogVisibility = () => {},
  onDeleteBoard = async () => {},
  onBoardLoaded = () => {},
}: Props) {
  useJsApi();
  return (
    <>
      <EditorDialog
        title="Board Configuration"
        isOpen={!!boardSource}
        value={boardSource || ""}
        onClose={onCloseBoardSource}
      />
      <LoadBoardDialog
        visible={!!loadBoardItems}
        items={loadBoardItems || []}
        onSetVisible={onChangeLoadDialogVisibility}
        onDeleteBoard={onDeleteBoard}
        onBoardLoaded={onBoardLoaded}
      />
    </>
  );
}
